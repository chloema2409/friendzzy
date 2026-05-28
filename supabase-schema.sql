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
