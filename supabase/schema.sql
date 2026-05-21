create extension if not exists pgcrypto;

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.couple_members (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (couple_id, user_id)
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prefecture_visits (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  prefecture_id integer not null check (prefecture_id between 1 and 47),
  visited_on date not null,
  place_name text not null,
  memo text,
  nights integer not null default 0 check (nights >= 0),
  tags text[] not null default '{}',
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visit_locations (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.prefecture_visits(id) on delete cascade,
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  visit_id uuid not null references public.prefecture_visits(id) on delete cascade,
  storage_path text not null unique,
  public_url text,
  caption text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.visit_comments (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  visit_id uuid not null references public.prefecture_visits(id) on delete cascade,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  comment_type text not null default 'comment' check (comment_type in ('comment', 'reaction', 'ai_note')),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  name text not null,
  color text not null default '#A7C4A0',
  created_at timestamptz not null default now(),
  unique (couple_id, name)
);

create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  prefecture_id integer not null check (prefecture_id between 1 and 47),
  title text not null,
  food text,
  sightseeing text,
  memo text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('visit_created', 'photo_added', 'wishlist_created')),
  title text not null,
  message text,
  related_prefecture integer check (related_prefecture between 1 and 47),
  related_visit_id uuid references public.prefecture_visits(id) on delete set null,
  related_wishlist_id uuid references public.wishlist(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
on public.notifications (recipient_user_id, created_at desc);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
on public.push_subscriptions (user_id);

create or replace function public.is_couple_member(target_couple_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as '
  select exists (
    select 1
    from public.couple_members
    where couple_id = target_couple_id
      and user_id = auth.uid()
  );
';

create or replace function public.create_couple(couple_name text)
returns text
language sql
security definer
set search_path = public
as '
  with new_couple as (
    insert into public.couples (name, created_by)
    values (couple_name, auth.uid())
    returning id, invite_code
  ),
  new_member as (
    insert into public.couple_members (couple_id, user_id, role)
    select id, auth.uid(), ''owner''
    from new_couple
  )
  select invite_code from new_couple;
';

create or replace function public.join_couple_by_invite_code(code text)
returns void
language sql
security definer
set search_path = public
as '
  insert into public.couple_members (couple_id, user_id, role)
  select id, auth.uid(), ''member''
  from public.couples
  where invite_code = upper(code)
  on conflict (couple_id, user_id) do nothing;
';

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.profiles enable row level security;
alter table public.prefecture_visits enable row level security;
alter table public.visit_locations enable row level security;
alter table public.photos enable row level security;
alter table public.visit_comments enable row level security;
alter table public.tags enable row level security;
alter table public.wishlist enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "members can read their couples" on public.couples;
drop policy if exists "members can read memberships" on public.couple_members;
drop policy if exists "users can insert own profile" on public.profiles;
drop policy if exists "users can update own profile" on public.profiles;
drop policy if exists "members can read couple profiles" on public.profiles;
drop policy if exists "members can manage visits" on public.prefecture_visits;
drop policy if exists "members can manage locations" on public.visit_locations;
drop policy if exists "members can manage photos" on public.photos;
drop policy if exists "members can manage visit comments" on public.visit_comments;
drop policy if exists "members can manage tags" on public.tags;
drop policy if exists "members can manage wishlist" on public.wishlist;
drop policy if exists "users can read own notifications" on public.notifications;
drop policy if exists "users can update own notifications" on public.notifications;
drop policy if exists "members can create recipient notifications" on public.notifications;
drop policy if exists "users can manage own push subscriptions" on public.push_subscriptions;
drop policy if exists "members can upload travel photos" on storage.objects;
drop policy if exists "members can update travel photos" on storage.objects;
drop policy if exists "members can delete travel photos" on storage.objects;
drop policy if exists "members can read travel photos" on storage.objects;

create policy "members can read their couples"
on public.couples for select
using (public.is_couple_member(id));

create policy "members can read memberships"
on public.couple_members for select
using (public.is_couple_member(couple_id));

create policy "users can insert own profile"
on public.profiles for insert
with check (user_id = auth.uid());

create policy "users can update own profile"
on public.profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "members can read couple profiles"
on public.profiles for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.couple_members mine
    join public.couple_members theirs on theirs.couple_id = mine.couple_id
    where mine.user_id = auth.uid()
      and theirs.user_id = profiles.user_id
  )
);

create policy "members can manage visits"
on public.prefecture_visits for all
using (public.is_couple_member(couple_id))
with check (public.is_couple_member(couple_id));

create policy "members can manage locations"
on public.visit_locations for all
using (
  exists (
    select 1 from public.prefecture_visits v
    where v.id = visit_id and public.is_couple_member(v.couple_id)
  )
)
with check (
  exists (
    select 1 from public.prefecture_visits v
    where v.id = visit_id and public.is_couple_member(v.couple_id)
  )
);

create policy "members can manage photos"
on public.photos for all
using (public.is_couple_member(couple_id))
with check (public.is_couple_member(couple_id));

create policy "members can manage visit comments"
on public.visit_comments for all
using (public.is_couple_member(couple_id))
with check (
  public.is_couple_member(couple_id)
  and exists (
    select 1 from public.prefecture_visits v
    where v.id = visit_id and v.couple_id = visit_comments.couple_id
  )
);

create policy "members can manage tags"
on public.tags for all
using (public.is_couple_member(couple_id))
with check (public.is_couple_member(couple_id));

create policy "members can manage wishlist"
on public.wishlist for all
using (public.is_couple_member(couple_id))
with check (public.is_couple_member(couple_id));

create policy "users can read own notifications"
on public.notifications for select
using (recipient_user_id = auth.uid());

create policy "users can update own notifications"
on public.notifications for update
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

create policy "members can create recipient notifications"
on public.notifications for insert
with check (
  actor_user_id = auth.uid()
  and recipient_user_id <> auth.uid()
  and public.is_couple_member(couple_id)
  and exists (
    select 1
    from public.couple_members recipient
    where recipient.couple_id = notifications.couple_id
      and recipient.user_id = notifications.recipient_user_id
  )
);

create policy "users can manage own push subscriptions"
on public.push_subscriptions for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('travel-photos', 'travel-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "members can upload travel photos"
on storage.objects for insert
with check (
  bucket_id = 'travel-photos'
  and public.is_couple_member((storage.foldername(name))[1]::uuid)
);

create policy "members can update travel photos"
on storage.objects for update
using (
  bucket_id = 'travel-photos'
  and public.is_couple_member((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'travel-photos'
  and public.is_couple_member((storage.foldername(name))[1]::uuid)
);

create policy "members can delete travel photos"
on storage.objects for delete
using (
  bucket_id = 'travel-photos'
  and public.is_couple_member((storage.foldername(name))[1]::uuid)
);

create policy "members can read travel photos"
on storage.objects for select
using (
  bucket_id = 'travel-photos'
  and public.is_couple_member((storage.foldername(name))[1]::uuid)
);

grant execute on function public.create_couple(text) to authenticated;
grant execute on function public.join_couple_by_invite_code(text) to authenticated;
