-- Friendzzy / Bestie Quiz online sharing tables.
-- Run this in the Supabase SQL editor for the project:
-- https://henagvofjujsksuuuhfe.supabase.co
--
-- This uses the publishable key from the app, so Row Level Security policies
-- allow safe public quiz play without storing real names, emails, or passwords.

create extension if not exists pgcrypto;

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

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  from_user_id uuid references auth.users(id) on delete set null,
  to_user_id uuid references auth.users(id) on delete set null,
  from_friend_code text not null,
  to_friend_code text not null,
  from_nickname text not null,
  from_emoji_avatar text not null default '🌙',
  to_nickname text not null,
  to_emoji_avatar text not null default '🌙',
  status text not null default 'pending',
  message text not null default 'Hi! Can we be friends?',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_friend_code <> to_friend_code),
  check (from_friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'),
  check (to_friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'),
  check (char_length(from_nickname) between 1 and 20),
  check (char_length(to_nickname) between 1 and 20),
  check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  check (message in (
    'Hi! Can we be friends?',
    'It''s me from school!',
    'Let''s play quizzes together!',
    'Want to be friends?'
  ))
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  sender_friend_code text not null,
  receiver_friend_code text not null,
  sender_nickname text not null,
  sender_emoji_avatar text not null default '🌙',
  receiver_nickname text not null,
  receiver_emoji_avatar text not null default '🌙',
  message_text text not null,
  message_type text not null default 'typed',
  sticker text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.game_invites (
  id uuid primary key default gen_random_uuid(),
  invite_id text not null unique,
  game_type text not null,
  from_friend_code text not null,
  to_friend_code text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (from_friend_code <> to_friend_code),
  check (game_type in ('box_of_lies', 'trading_game')),
  check (status in ('pending', 'accepted', 'declined', 'in_progress', 'completed', 'expired', 'cancelled'))
);

create table if not exists public.player_inventories (
  id uuid primary key default gen_random_uuid(),
  friend_code text not null unique,
  inventory_json jsonb not null default '{"items":[],"gems":0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_inventories
alter column inventory_json set default '{"items":[],"gems":0}'::jsonb;

-- Auth-backed cross-device account columns.
-- These keep the older local/friend-code MVP working while adding real
-- Supabase Auth ownership.
alter table public.profiles
add column if not exists user_id uuid references auth.users(id) on delete cascade,
add column if not exists active_theme text not null default 'default';

alter table public.quizzes
add column if not exists owner_id uuid references auth.users(id) on delete cascade,
add column if not exists local_quiz_id text,
add column if not exists updated_at timestamptz not null default now();

alter table public.friends
add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
add column if not exists friend_user_id uuid references auth.users(id) on delete cascade;

alter table public.messages
add column if not exists sender_user_id uuid references auth.users(id) on delete cascade,
add column if not exists receiver_user_id uuid references auth.users(id) on delete cascade,
add column if not exists quiz_id text,
add column if not exists quiz_title text,
add column if not exists quiz_link text,
add column if not exists quiz_question_count integer,
add column if not exists game_data jsonb not null default '{}'::jsonb;

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  purchased_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_entry_id text not null,
  text text not null,
  mood text,
  sticker text,
  created_at timestamptz not null default now(),
  unique (user_id, local_entry_id)
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  normalized_username text not null unique,
  pin_hash text not null,
  friend_code text not null unique,
  emoji_avatar text not null default '🌙',
  stars integer not null default 0,
  active_theme text not null default 'default',
  purchases_json jsonb not null default '[]'::jsonb,
  saved_quizzes_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(username) between 1 and 20),
  check (char_length(normalized_username) between 1 and 20),
  check (friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'),
  check (stars >= 0)
);

alter table public.profiles enable row level security;
alter table public.friends enable row level security;
alter table public.friend_requests enable row level security;
alter table public.messages enable row level security;
alter table public.game_invites enable row level security;
alter table public.player_inventories enable row level security;
alter table public.purchases enable row level security;
alter table public.diary_entries enable row level security;
alter table public.players enable row level security;

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

drop policy if exists "Logged-in users can create their own profile" on public.profiles;
create policy "Logged-in users can create their own profile"
on public.profiles
for insert
to authenticated
with check (
  user_id = auth.uid()
  and char_length(nickname) between 1 and 20
  and char_length(normalized_nickname) between 1 and 20
  and friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and stars >= 0
);

drop policy if exists "Logged-in users can update their own profile" on public.profiles;
create policy "Logged-in users can update their own profile"
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and char_length(nickname) between 1 and 20
  and char_length(normalized_nickname) between 1 and 20
  and friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and stars >= 0
);

drop policy if exists "Logged-in users can read their own profile" on public.profiles;
create policy "Logged-in users can read their own profile"
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

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

drop policy if exists "Logged-in users can manage their own friend rows" on public.friends;
create policy "Logged-in users can manage their own friend rows"
on public.friends
for all
to authenticated
using (owner_user_id = auth.uid() or friend_user_id = auth.uid())
with check (owner_user_id = auth.uid() or friend_user_id = auth.uid());

drop policy if exists "Anyone can view temporary friend requests" on public.friend_requests;
create policy "Anyone can view temporary friend requests"
on public.friend_requests
for select
to anon
using (true);

drop policy if exists "Anyone can create a safe temporary friend request" on public.friend_requests;
create policy "Anyone can create a safe temporary friend request"
on public.friend_requests
for insert
to anon
with check (
  status = 'pending'
  and from_friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and to_friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and from_friend_code <> to_friend_code
  and char_length(from_nickname) between 1 and 20
  and char_length(to_nickname) between 1 and 20
  and message in (
    'Hi! Can we be friends?',
    'It''s me from school!',
    'Let''s play quizzes together!',
    'Want to be friends?'
  )
);

drop policy if exists "Anyone can update temporary friend request status" on public.friend_requests;
create policy "Anyone can update temporary friend request status"
on public.friend_requests
for update
to anon
using (true)
with check (
  status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')
  and from_friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and to_friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and from_friend_code <> to_friend_code
  and char_length(from_nickname) between 1 and 20
  and char_length(to_nickname) between 1 and 20
  and message in (
    'Hi! Can we be friends?',
    'It''s me from school!',
    'Let''s play quizzes together!',
    'Want to be friends?'
  )
);

drop policy if exists "Logged-in users can manage their friend requests" on public.friend_requests;
create policy "Logged-in users can manage their friend requests"
on public.friend_requests
for all
to authenticated
using (from_user_id = auth.uid() or to_user_id = auth.uid())
with check (from_user_id = auth.uid() or to_user_id = auth.uid());

drop policy if exists "Anyone can add a safe temporary friend message" on public.messages;
create policy "Anyone can add a safe temporary friend message"
on public.messages
for insert
to anon
with check (
  sender_friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and receiver_friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and sender_friend_code <> receiver_friend_code
  and conversation_id = least(sender_friend_code, receiver_friend_code) || '__' || greatest(sender_friend_code, receiver_friend_code)
  and char_length(sender_nickname) between 1 and 20
  and char_length(receiver_nickname) between 1 and 20
  and char_length(message_text) between 1 and 150
  and message_type in ('typed', 'text', 'quick', 'preset', 'sticker', 'game_invite', 'quiz_invite', 'box_of_lies_invite', 'trading_game_offer')
  and (
    message_type <> 'quiz_invite'
    or (
      quiz_id is not null
      and quiz_link is not null
      and quiz_link like '%?quiz=%'
      and char_length(coalesce(quiz_title, '')) between 1 and 80
      and quiz_question_count between 1 and 30
    )
  )
  and exists (
    select 1
    from public.friends approved_friend
    where approved_friend.owner_friend_code = sender_friend_code
      and approved_friend.friend_friend_code = receiver_friend_code
  )
);

drop policy if exists "Logged-in friends can add private messages" on public.messages;
create policy "Logged-in friends can add private messages"
on public.messages
for insert
to authenticated
with check (
  sender_user_id = auth.uid()
  and sender_user_id <> receiver_user_id
  and char_length(message_text) between 1 and 150
  and message_type in ('typed', 'text', 'quick', 'preset', 'sticker', 'game_invite', 'quiz_invite', 'box_of_lies_invite', 'trading_game_offer')
  and (
    message_type <> 'quiz_invite'
    or (
      quiz_id is not null
      and quiz_link is not null
      and quiz_link like '%?quiz=%'
      and char_length(coalesce(quiz_title, '')) between 1 and 80
      and quiz_question_count between 1 and 30
    )
  )
  and (
    exists (
      select 1
      from public.friends approved_friend
      where approved_friend.owner_user_id = sender_user_id
        and approved_friend.friend_user_id = receiver_user_id
    )
    or exists (
      select 1
      from public.friends approved_friend
      where approved_friend.owner_friend_code = sender_friend_code
        and approved_friend.friend_friend_code = receiver_friend_code
    )
  )
);

drop policy if exists "Anyone can view safe temporary friend conversations" on public.messages;
create policy "Anyone can view safe temporary friend conversations"
on public.messages
for select
to anon
using (
  conversation_id = least(sender_friend_code, receiver_friend_code) || '__' || greatest(sender_friend_code, receiver_friend_code)
  and exists (
    select 1
    from public.friends approved_friend
    where approved_friend.owner_friend_code = sender_friend_code
      and approved_friend.friend_friend_code = receiver_friend_code
  )
);

drop policy if exists "Logged-in users can read their private messages" on public.messages;
create policy "Logged-in users can read their private messages"
on public.messages
for select
to authenticated
using (sender_user_id = auth.uid() or receiver_user_id = auth.uid());

drop policy if exists "Friends can save shared game invites" on public.game_invites;
create policy "Friends can save shared game invites"
on public.game_invites
for insert
to anon, authenticated
with check (
  invite_id ~ '^[A-Za-z0-9-]{8,80}$'
  and game_type in ('box_of_lies', 'trading_game')
  and status in ('pending', 'accepted', 'declined', 'in_progress', 'completed', 'expired', 'cancelled')
  and from_friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and to_friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and from_friend_code <> to_friend_code
  and jsonb_typeof(payload) = 'object'
  and exists (
    select 1
    from public.friends approved_friend
    where (
      approved_friend.owner_friend_code = from_friend_code
      and approved_friend.friend_friend_code = to_friend_code
    )
    or (
      approved_friend.owner_friend_code = to_friend_code
      and approved_friend.friend_friend_code = from_friend_code
    )
  )
);

drop policy if exists "Friends can refresh shared game invites" on public.game_invites;
create policy "Friends can refresh shared game invites"
on public.game_invites
for update
to anon, authenticated
using (
  exists (
    select 1
    from public.friends approved_friend
    where (
      approved_friend.owner_friend_code = from_friend_code
      and approved_friend.friend_friend_code = to_friend_code
    )
    or (
      approved_friend.owner_friend_code = to_friend_code
      and approved_friend.friend_friend_code = from_friend_code
    )
  )
)
with check (
  invite_id ~ '^[A-Za-z0-9-]{8,80}$'
  and game_type in ('box_of_lies', 'trading_game')
  and status in ('pending', 'accepted', 'declined', 'in_progress', 'completed', 'expired', 'cancelled')
  and from_friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and to_friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and from_friend_code <> to_friend_code
  and jsonb_typeof(payload) = 'object'
  and exists (
    select 1
    from public.friends approved_friend
    where (
      approved_friend.owner_friend_code = from_friend_code
      and approved_friend.friend_friend_code = to_friend_code
    )
    or (
      approved_friend.owner_friend_code = to_friend_code
      and approved_friend.friend_friend_code = from_friend_code
    )
  )
);

drop policy if exists "Friends can read shared game invites" on public.game_invites;
create policy "Friends can read shared game invites"
on public.game_invites
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.friends approved_friend
    where (
      approved_friend.owner_friend_code = from_friend_code
      and approved_friend.friend_friend_code = to_friend_code
    )
    or (
      approved_friend.owner_friend_code = to_friend_code
      and approved_friend.friend_friend_code = from_friend_code
    )
  )
);

drop policy if exists "Players can save their game inventory" on public.player_inventories;
create policy "Players can save their game inventory"
on public.player_inventories
for insert
to anon, authenticated
with check (
  friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and (
    jsonb_typeof(inventory_json) = 'array'
    or (
      jsonb_typeof(inventory_json) = 'object'
      and (
        not (inventory_json ? 'items')
        or jsonb_typeof(inventory_json -> 'items') = 'array'
      )
      and (
        not (inventory_json ? 'gems')
        or jsonb_typeof(inventory_json -> 'gems') = 'number'
      )
    )
  )
);

drop policy if exists "Players can refresh their game inventory" on public.player_inventories;
create policy "Players can refresh their game inventory"
on public.player_inventories
for update
to anon, authenticated
using (friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$')
with check (
  friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$'
  and (
    jsonb_typeof(inventory_json) = 'array'
    or (
      jsonb_typeof(inventory_json) = 'object'
      and (
        not (inventory_json ? 'items')
        or jsonb_typeof(inventory_json -> 'items') = 'array'
      )
      and (
        not (inventory_json ? 'gems')
        or jsonb_typeof(inventory_json -> 'gems') = 'number'
      )
    )
  )
);

drop policy if exists "Players can read game inventories" on public.player_inventories;
create policy "Players can read game inventories"
on public.player_inventories
for select
to anon, authenticated
using (friend_code ~ '^[A-Z0-9]{3,8}-[0-9]{4}$');

drop policy if exists "Users can read their purchases" on public.purchases;
create policy "Users can read their purchases"
on public.purchases
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can save their purchases" on public.purchases;
create policy "Users can save their purchases"
on public.purchases
for insert
to authenticated
with check (user_id = auth.uid() and char_length(item_id) between 1 and 80);

drop policy if exists "Users can refresh their purchases" on public.purchases;
create policy "Users can refresh their purchases"
on public.purchases
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and char_length(item_id) between 1 and 80);

drop policy if exists "Users can read their diary entries" on public.diary_entries;
create policy "Users can read their diary entries"
on public.diary_entries
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can save their diary entries" on public.diary_entries;
create policy "Users can save their diary entries"
on public.diary_entries
for insert
to authenticated
with check (
  user_id = auth.uid()
  and char_length(text) between 1 and 500
  and char_length(local_entry_id) between 1 and 120
);

drop policy if exists "Users can refresh their diary entries" on public.diary_entries;
create policy "Users can refresh their diary entries"
on public.diary_entries
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and char_length(text) between 1 and 500
  and char_length(local_entry_id) between 1 and 120
);

drop policy if exists "Users can manage their own saved quizzes" on public.quizzes;
create policy "Users can manage their own saved quizzes"
on public.quizzes
for all
to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and char_length(quiz_id) between 4 and 40
  and jsonb_typeof(questions_json) = 'array'
);

-- Username + PIN MVP functions.
-- This is MVP-only and should be replaced with Supabase Auth or server-side
-- parent accounts before storing private/sensitive data. PINs are not stored
-- in plaintext; pgcrypto hashes and checks them inside Supabase.

create or replace function public.create_player_account(
  player_username text,
  player_pin text,
  player_emoji_avatar text default '🌙'
)
returns table (
  id uuid,
  username text,
  normalized_username text,
  friend_code text,
  emoji_avatar text,
  stars integer,
  active_theme text,
  purchases_json jsonb,
  saved_quizzes_json jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  clean_username text := trim(player_username);
  normalized text := lower(trim(player_username));
  code_prefix text := upper(substring(regexp_replace(trim(player_username), '[^a-zA-Z0-9]', '', 'g') from 1 for 4));
  generated_code text;
begin
  if normalized = '' or char_length(clean_username) > 20 then
    raise exception 'INVALID_USERNAME';
  end if;

  if clean_username ~* '^[a-z]+[[:space:]]+[a-z]+' then
    raise exception 'INVALID_USERNAME';
  end if;

  if player_pin !~ '^[0-9]{4,6}$' then
    raise exception 'INVALID_PIN';
  end if;

  if exists (select 1 from public.players existing where existing.normalized_username = normalized) then
    raise exception 'USERNAME_TAKEN';
  end if;

  if char_length(code_prefix) < 3 then
    code_prefix := 'CASE';
  end if;

  loop
    generated_code := code_prefix || '-' || floor(1000 + random() * 9000)::int::text;
    exit when not exists (select 1 from public.players existing where existing.friend_code = generated_code);
  end loop;

  return query
  insert into public.players (
    username,
    normalized_username,
    pin_hash,
    friend_code,
    emoji_avatar
  )
  values (
    clean_username,
    normalized,
    crypt(player_pin, gen_salt('bf')),
    generated_code,
    coalesce(nullif(player_emoji_avatar, ''), '🌙')
  )
  returning
    players.id,
    players.username,
    players.normalized_username,
    players.friend_code,
    players.emoji_avatar,
    players.stars,
    players.active_theme,
    players.purchases_json,
    players.saved_quizzes_json,
    players.created_at,
    players.updated_at;
end;
$$;

create or replace function public.login_player_with_pin(
  player_username text,
  player_pin text
)
returns table (
  id uuid,
  username text,
  normalized_username text,
  friend_code text,
  emoji_avatar text,
  stars integer,
  active_theme text,
  purchases_json jsonb,
  saved_quizzes_json jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized text := lower(trim(player_username));
begin
  if normalized = '' or player_pin !~ '^[0-9]{4,6}$' then
    raise exception 'INVALID_LOGIN';
  end if;

  return query
  select
    p.id,
    p.username,
    p.normalized_username,
    p.friend_code,
    p.emoji_avatar,
    p.stars,
    p.active_theme,
    p.purchases_json,
    p.saved_quizzes_json,
    p.created_at,
    p.updated_at
  from public.players p
  where p.normalized_username = normalized
    and p.pin_hash = crypt(player_pin, p.pin_hash)
  limit 1;
end;
$$;

create or replace function public.save_player_progress(
  player_username text,
  player_pin text,
  player_emoji_avatar text,
  player_stars integer,
  player_active_theme text,
  player_purchases_json jsonb,
  player_saved_quizzes_json jsonb
)
returns table (
  id uuid,
  username text,
  normalized_username text,
  friend_code text,
  emoji_avatar text,
  stars integer,
  active_theme text,
  purchases_json jsonb,
  saved_quizzes_json jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized text := lower(trim(player_username));
begin
  if normalized = '' or player_pin !~ '^[0-9]{4,6}$' then
    raise exception 'INVALID_LOGIN';
  end if;

  if jsonb_typeof(coalesce(player_purchases_json, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_PURCHASES';
  end if;

  if jsonb_typeof(coalesce(player_saved_quizzes_json, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_QUIZZES';
  end if;

  update public.players p
  set
    emoji_avatar = coalesce(nullif(player_emoji_avatar, ''), p.emoji_avatar),
    stars = greatest(0, coalesce(player_stars, p.stars)),
    active_theme = coalesce(nullif(player_active_theme, ''), 'default'),
    purchases_json = coalesce(player_purchases_json, '[]'::jsonb),
    saved_quizzes_json = coalesce(player_saved_quizzes_json, '[]'::jsonb),
    updated_at = now()
  where p.normalized_username = normalized
    and p.pin_hash = crypt(player_pin, p.pin_hash);

  return query
  select
    p.id,
    p.username,
    p.normalized_username,
    p.friend_code,
    p.emoji_avatar,
    p.stars,
    p.active_theme,
    p.purchases_json,
    p.saved_quizzes_json,
    p.created_at,
    p.updated_at
  from public.players p
  where p.normalized_username = normalized
    and p.pin_hash = crypt(player_pin, p.pin_hash)
  limit 1;
end;
$$;

grant execute on function public.create_player_account(text, text, text) to anon, authenticated;
grant execute on function public.login_player_with_pin(text, text) to anon, authenticated;
grant execute on function public.save_player_progress(text, text, text, integer, text, jsonb, jsonb) to anon, authenticated;

create index if not exists profiles_friend_code_idx on public.profiles (friend_code);
create index if not exists profiles_user_id_idx on public.profiles (user_id);
create index if not exists players_normalized_username_idx on public.players (normalized_username);
create index if not exists players_friend_code_idx on public.players (friend_code);
create index if not exists friends_owner_friend_code_idx on public.friends (owner_friend_code);
create index if not exists friends_friend_friend_code_idx on public.friends (friend_friend_code);
create index if not exists friends_owner_user_id_idx on public.friends (owner_user_id);
create index if not exists friends_friend_user_id_idx on public.friends (friend_user_id);
create index if not exists friend_requests_from_to_updated_idx on public.friend_requests (from_friend_code, to_friend_code, updated_at desc);
create index if not exists friend_requests_to_status_updated_idx on public.friend_requests (to_friend_code, status, updated_at desc);
create unique index if not exists friend_requests_pending_pair_idx
on public.friend_requests (from_friend_code, to_friend_code)
where status = 'pending';
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at asc);
create index if not exists messages_sender_receiver_idx on public.messages (sender_friend_code, receiver_friend_code);
create index if not exists messages_sender_receiver_user_idx on public.messages (sender_user_id, receiver_user_id);
create index if not exists game_invites_invite_id_idx on public.game_invites (invite_id);
create index if not exists game_invites_from_to_updated_idx on public.game_invites (from_friend_code, to_friend_code, updated_at desc);
create index if not exists game_invites_to_from_updated_idx on public.game_invites (to_friend_code, from_friend_code, updated_at desc);
create index if not exists player_inventories_friend_code_idx on public.player_inventories (friend_code);
create index if not exists purchases_user_id_idx on public.purchases (user_id);
create index if not exists diary_entries_user_created_idx on public.diary_entries (user_id, created_at desc);

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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_user_id_key'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_user_id_key
    unique (user_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quizzes_owner_id_local_quiz_id_key'
      and conrelid = 'public.quizzes'::regclass
  ) then
    alter table public.quizzes
    add constraint quizzes_owner_id_local_quiz_id_key
    unique (owner_id, local_quiz_id);
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
