-- Allow CSV source files up to 100 MiB in the private bucket.
-- The Supabase project-wide Storage limit must also allow at least 100 MiB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reviewlens-private', 'reviewlens-private', false, 104857600, array['text/csv', 'application/vnd.ms-excel', 'text/plain'])
on conflict (id) do update set
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = excluded.allowed_mime_types;
