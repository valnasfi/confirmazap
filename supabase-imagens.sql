-- ConfirmaZap - logo e banner do negócio
-- Rode no Supabase SQL Editor (depois do supabase.sql e do supabase-admin.sql).

-- 1) Coluna do banner e permissões (o logo já existe: logo_url)
alter table public.businesses add column if not exists banner_url text;
grant select (banner_url) on public.businesses to anon;
grant update (banner_url) on public.businesses to authenticated;

-- 2) Pasta pública de imagens (até 2 MB por arquivo; só PNG, JPG e WebP)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-assets', 'business-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3) Cada dono mexe só na pasta do próprio negócio: business-assets/<id do negócio>/...
-- Quem só visita a página lê as imagens pelo endereço público, sem precisar de permissão.
drop policy if exists "business assets owner select" on storage.objects;
create policy "business assets owner select" on storage.objects for select to authenticated
  using (bucket_id = 'business-assets' and exists (
    select 1 from public.businesses b where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));

drop policy if exists "business assets owner insert" on storage.objects;
create policy "business assets owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'business-assets' and exists (
    select 1 from public.businesses b where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));

drop policy if exists "business assets owner update" on storage.objects;
create policy "business assets owner update" on storage.objects for update to authenticated
  using (bucket_id = 'business-assets' and exists (
    select 1 from public.businesses b where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()))
  with check (bucket_id = 'business-assets' and exists (
    select 1 from public.businesses b where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));

drop policy if exists "business assets owner delete" on storage.objects;
create policy "business assets owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'business-assets' and exists (
    select 1 from public.businesses b where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));
