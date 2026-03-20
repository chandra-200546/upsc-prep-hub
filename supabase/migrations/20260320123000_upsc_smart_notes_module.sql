create table if not exists public.upsc_smart_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id text not null,
  subject_name text not null,
  topic text not null,
  slides_count integer not null default 0,
  deck_json jsonb not null,
  current_slide integer not null default 0,
  passed_checkpoints integer[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.upsc_smart_notes enable row level security;

create policy "Users can read own smart notes"
on public.upsc_smart_notes
for select
using (auth.uid() = user_id);

create policy "Users can create own smart notes"
on public.upsc_smart_notes
for insert
with check (auth.uid() = user_id);

create policy "Users can update own smart notes"
on public.upsc_smart_notes
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own smart notes"
on public.upsc_smart_notes
for delete
using (auth.uid() = user_id);

create index if not exists idx_upsc_smart_notes_user_created on public.upsc_smart_notes(user_id, created_at desc);
create index if not exists idx_upsc_smart_notes_topic on public.upsc_smart_notes(topic);

