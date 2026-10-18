-- ReviewLens schema. Apply with `supabase db push` after linking a Supabase project.
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'light' check (theme in ('light', 'dark', 'system')),
  default_export_format text not null default 'csv' check (default_export_format in ('csv', 'xlsx', 'pdf', 'json')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  source_type text not null check (source_type in ('sample', 'upload', 'manual')),
  original_filename text,
  storage_path text unique,
  row_count integer not null default 0 check (row_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((source_type = 'upload') or (storage_path is null and original_filename is null))
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  review_text text not null check (char_length(review_text) <= 20000),
  rating numeric(2,1) check (rating is null or rating between 1 and 5),
  review_date date,
  product_name text check (product_name is null or char_length(product_name) <= 200),
  sentiment text not null default 'neutral' check (sentiment in ('positive', 'neutral', 'negative')),
  positive_score integer not null default 0 check (positive_score >= 0),
  negative_score integer not null default 0 check (negative_score >= 0),
  word_count integer not null default 0 check (word_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid references public.datasets(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  dataset_name text not null,
  algorithm_version text not null,
  total_reviews integer not null check (total_reviews >= 0),
  positive_count integer not null check (positive_count >= 0),
  neutral_count integer not null check (neutral_count >= 0),
  negative_count integer not null check (negative_count >= 0),
  average_rating numeric(3,2),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (positive_count + neutral_count + negative_count = total_reviews)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dataset_id uuid references public.datasets(id) on delete set null,
  analysis_run_id uuid references public.analysis_runs(id) on delete set null,
  report_type text not null,
  format text not null check (format in ('csv', 'xlsx', 'pdf', 'json')),
  storage_path text,
  created_at timestamptz not null default now()
);

-- Backfill users who existed before this migration was applied.
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name', '') from auth.users
on conflict (id) do nothing;
insert into public.user_preferences (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create index datasets_owner_created_idx on public.datasets(user_id, created_at desc);
create index reviews_owner_dataset_idx on public.reviews(user_id, dataset_id);
create index reviews_dataset_date_idx on public.reviews(dataset_id, review_date desc);
create index reviews_dataset_sentiment_idx on public.reviews(dataset_id, sentiment);
create index reviews_dataset_product_idx on public.reviews(dataset_id, product_name);
create index reviews_text_search_idx on public.reviews using gin (review_text gin_trgm_ops);
create index reviews_product_search_idx on public.reviews using gin (product_name gin_trgm_ops);
create index analysis_runs_owner_created_idx on public.analysis_runs(user_id, created_at desc);
create index reports_owner_created_idx on public.reports(user_id, created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger preferences_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();
create trigger datasets_updated_at before update on public.datasets for each row execute function public.set_updated_at();
create trigger reviews_updated_at before update on public.reviews for each row execute function public.set_updated_at();

create or replace function public.create_user_records() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', '')) on conflict (id) do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger auth_user_created after insert on auth.users for each row execute function public.create_user_records();
revoke all on function public.create_user_records() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.datasets enable row level security;
alter table public.reviews enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.reports enable row level security;

create policy "profiles own record" on public.profiles for all using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "preferences own record" on public.user_preferences for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "datasets own records" on public.datasets for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "reviews own records" on public.reviews for all using (
  user_id = (select auth.uid()) and exists (select 1 from public.datasets d where d.id = dataset_id and d.user_id = (select auth.uid()))
) with check (
  user_id = (select auth.uid()) and exists (select 1 from public.datasets d where d.id = dataset_id and d.user_id = (select auth.uid()))
);
create policy "analysis runs own records" on public.analysis_runs for all using (user_id = (select auth.uid())) with check (
  user_id = (select auth.uid()) and (dataset_id is null or exists (select 1 from public.datasets d where d.id = dataset_id and d.user_id = (select auth.uid())))
);
create policy "reports own records" on public.reports for all using (user_id = (select auth.uid())) with check (
  user_id = (select auth.uid()) and (dataset_id is null or exists (select 1 from public.datasets d where d.id = dataset_id and d.user_id = (select auth.uid())))
);

-- Original uploads remain private. Object paths are prefixed with the authenticated user UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reviewlens-private', 'reviewlens-private', false, 104857600, array['text/csv', 'application/vnd.ms-excel', 'text/plain'])
on conflict (id) do update set public = false, file_size_limit = 104857600;

create policy "owners manage private review files" on storage.objects for all using (
  bucket_id = 'reviewlens-private' and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id = 'reviewlens-private' and (storage.foldername(name))[1] = (select auth.uid())::text
);
