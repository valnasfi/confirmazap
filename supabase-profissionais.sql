-- ConfirmaZap - vários profissionais por negócio
-- Rode UMA vez no Supabase SQL Editor (depois do supabase-lembretes.sql).

-- 1) Profissionais (cada um tem a própria agenda)
create table if not exists public.professionals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists professionals_business_idx on public.professionals (business_id);

alter table public.appointments add column if not exists professional_id uuid references public.professionals(id) on delete set null;
create index if not exists appointments_professional_start_idx on public.appointments (professional_id, start_at);

-- 2) Todo negócio que já existe ganha um profissional com o nome do negócio, e os agendamentos antigos passam a ser dele
insert into public.professionals (business_id, name)
select b.id, b.name from public.businesses b
where not exists (select 1 from public.professionals p where p.business_id = b.id);

update public.appointments a
set professional_id = (select p.id from public.professionals p where p.business_id = a.business_id order by p.created_at, p.id limit 1)
where a.professional_id is null;

-- 3) Negócio novo já nasce com um profissional
create or replace function public.create_default_professional()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.professionals (business_id, name) values (new.id, new.name);
  return new;
end
$$;
drop trigger if exists trg_business_professional on public.businesses;
create trigger trg_business_professional after insert on public.businesses
  for each row execute function public.create_default_professional();

-- 4) Permissões: o público vê só os ativos de negócios ativos; o dono gerencia os dele
alter table public.professionals enable row level security;
grant select on public.professionals to anon;
grant select, insert, update, delete on public.professionals to authenticated;
grant all on public.professionals to service_role;

drop policy if exists "public read professionals" on public.professionals;
create policy "public read professionals" on public.professionals for select to anon
  using (active = true and exists (select 1 from public.businesses b where b.id = business_id and b.status = 'active'));

drop policy if exists "owner all professionals" on public.professionals;
create policy "owner all professionals" on public.professionals for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
