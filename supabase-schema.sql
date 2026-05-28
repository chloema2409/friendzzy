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
add column if not exists receiver_user_id uuid references auth.users(id) on delete cascade;

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

alter table public.profiles enable row level security;
alter table public.friends enable row level security;
alter table public.messages enable row level security;
alter table public.purchases enable row level security;
alter table public.diary_entries enable row level security;

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
  and message_type in ('typed', 'text', 'quick', 'preset', 'sticker', 'game_invite')
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
  and message_type in ('typed', 'text', 'quick', 'preset', 'sticker', 'game_invite')
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

create index if not exists profiles_friend_code_idx on public.profiles (friend_code);
create index if not exists profiles_user_id_idx on public.profiles (user_id);
create index if not exists friends_owner_friend_code_idx on public.friends (owner_friend_code);
create index if not exists friends_friend_friend_code_idx on public.friends (friend_friend_code);
create index if not exists friends_owner_user_id_idx on public.friends (owner_user_id);
create index if not exists friends_friend_user_id_idx on public.friends (friend_user_id);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at asc);
create index if not exists messages_sender_receiver_idx on public.messages (sender_friend_code, receiver_friend_code);
create index if not exists messages_sender_receiver_user_idx on public.messages (sender_user_id, receiver_user_id);
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
