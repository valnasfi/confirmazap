-- ConfirmaZap - quais profissionais fazem cada serviço
-- Rode UMA vez no Supabase SQL Editor (depois do supabase-profissionais.sql).
-- Serviço sem nenhum profissional marcado = todos os profissionais fazem.
create table if not exists public.professional_services (
  professional_id uuid not null references public.professionals(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (professional_id, service_id)
);
create index if not exists professional_services_service_idx on public.professional_services (service_id);

alter table public.professional_services enable row level security;
grant select on public.professional_services to anon;
grant select, insert, update, delete on public.professional_services to authenticated;
grant all on public.professional_services to service_role;

drop policy if exists "public read professional_services" on public.professional_services;
create policy "public read professional_services" on public.professional_services for select to anon using (true);

drop policy if exists "owner all professional_services" on public.professional_services;
create policy "owner all professional_services" on public.professional_services for all to authenticated
  using (exists (select 1 from public.professionals p join public.businesses b on b.id = p.business_id where p.id = professional_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.professionals p join public.businesses b on b.id = p.business_id where p.id = professional_id and b.owner_id = auth.uid()));
