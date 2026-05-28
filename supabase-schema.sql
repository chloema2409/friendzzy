-- Friendzzy / Bestie Quiz online sharing tables.
-- Run this in the Supabase SQL editor for the project:
-- https://henagvofjujsksuuuhfe.supabase.co
--
-- This uses the publishable key from the app, so Row Level Security policies
-- allow safe public quiz play without storing real names, emails, or passwords.

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  quiz_id text not null unique,
  title text not null,
  theme text,
  questions_json jsonb not null,
  creator_nickname text,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_scores (
  id uuid primary key default gen_random_uuid(),
  quiz_id text not null references public.quizzes(quiz_id) on delete cascade,
  nickname text not null,
  score_percent integer not null,
  correct_answers integer not null,
  total_questions integer not null,
  result_message text,
  created_at timestamptz not null default now()
);

alter table public.quizzes enable row level security;
alter table public.quiz_scores enable row level security;

drop policy if exists "Anyone can create shared quizzes" on public.quizzes;
create policy "Anyone can create shared quizzes"
on public.quizzes
for insert
to anon
with check (
  char_length(quiz_id) between 4 and 20
  and jsonb_typeof(questions_json) = 'array'
);

drop policy if exists "Anyone can play shared quizzes by quiz id" on public.quizzes;
create policy "Anyone can play shared quizzes by quiz id"
on public.quizzes
for select
to anon
using (true);

drop policy if exists "Anyone can add a quiz score" on public.quiz_scores;
create policy "Anyone can add a quiz score"
on public.quiz_scores
for insert
to anon
with check (
  char_length(nickname) between 1 and 20
  and score_percent between 0 and 100
  and correct_answers >= 0
  and total_questions between 1 and 30
);

drop policy if exists "Anyone can view quiz scoreboards" on public.quiz_scores;
create policy "Anyone can view quiz scoreboards"
on public.quiz_scores
for select
to anon
using (true);

create index if not exists quizzes_quiz_id_idx on public.quizzes (quiz_id);
create index if not exists quiz_scores_quiz_id_score_idx
on public.quiz_scores (quiz_id, score_percent desc, created_at asc);

-- Friend-code MVP tables.
-- These policies are intentionally temporary because the current app does not
-- use Supabase Auth yet. Friend codes act as the short-term player identifier.
-- Tighten these policies later when real accounts are added.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  normalized_nickname text not null,
  emoji_avatar text not null default '🌙',
  friend_code text not null unique,
  stars integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  owner_friend_code text not null,
  friend_friend_code text not null,
  friend_nickname text not null,
  friend_emoji_avatar text not null default '🌙',
  created_at timestamptz not null default now(),
  unique (owner_friend_code, friend_friend_code),
  check (owner_friend_code <> friend_friend_code)
);

alter table public.profiles enable row level security;
alter table public.friends enable row level security;

drop policy if exists "Anyone can find profiles by friend code" on public.profiles;
create policy "Anyone can find profiles by friend code"
on public.profiles
for select
to anon
using (true);

drop policy if exists "Anyone can create a temporary friend-code profile" on public.profiles;
create policy "Anyone can create a temporary friend-code profile"
on public.profiles
for insert
to anon
with check (
  char_length(nickname) between 1 and 20
  and char_length(normalized_nickname) between 1 and 20
  and friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and stars >= 0
);

drop policy if exists "Anyone can update a temporary friend-code profile" on public.profiles;
create policy "Anyone can update a temporary friend-code profile"
on public.profiles
for update
to anon
using (true)
with check (
  char_length(nickname) between 1 and 20
  and char_length(normalized_nickname) between 1 and 20
  and friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and stars >= 0
);

drop policy if exists "Anyone can view temporary friend links" on public.friends;
create policy "Anyone can view temporary friend links"
on public.friends
for select
to anon
using (true);

drop policy if exists "Anyone can add a temporary friend link" on public.friends;
create policy "Anyone can add a temporary friend link"
on public.friends
for insert
to anon
with check (
  owner_friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and friend_friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and owner_friend_code <> friend_friend_code
  and char_length(friend_nickname) between 1 and 20
);

drop policy if exists "Anyone can refresh a temporary friend link" on public.friends;
create policy "Anyone can refresh a temporary friend link"
on public.friends
for update
to anon
using (true)
with check (
  owner_friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and friend_friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and owner_friend_code <> friend_friend_code
  and char_length(friend_nickname) between 1 and 20
);

create index if not exists profiles_friend_code_idx on public.profiles (friend_code);
create index if not exists friends_owner_friend_code_idx on public.friends (owner_friend_code);
create index if not exists friends_friend_friend_code_idx on public.friends (friend_friend_code);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'friends_owner_friend_code_friend_friend_code_key'
      and conrelid = 'public.friends'::regclass
  ) then
    alter table public.friends
    add constraint friends_owner_friend_code_friend_friend_code_key
    unique (owner_friend_code, friend_friend_code);
  end if;
end $$;

-- Safely backfill reverse friendship rows for any old one-way friend links.
insert into public.friends (
  owner_friend_code,
  friend_friend_code,
  friend_nickname,
  friend_emoji_avatar
)
select
  existing.friend_friend_code as owner_friend_code,
  existing.owner_friend_code as friend_friend_code,
  coalesce(owner_profile.nickname, 'Friend') as friend_nickname,
  coalesce(owner_profile.emoji_avatar, '🌙') as friend_emoji_avatar
from public.friends existing
left join public.profiles owner_profile
  on owner_profile.friend_code = existing.owner_friend_code
where existing.owner_friend_code <> existing.friend_friend_code
on conflict (owner_friend_code, friend_friend_code) do update
set
  friend_nickname = excluded.friend_nickname,
  friend_emoji_avatar = excluded.friend_emoji_avatar;
