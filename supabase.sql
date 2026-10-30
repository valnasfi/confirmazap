-- ConfirmaZap - rode este arquivo no Supabase SQL Editor
create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp default now(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  slug text unique not null,
  whatsapp text,
  logo_url text,
  asaas_api_key text,
  settings jsonb default '{}'
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null,
  duration_minutes int not null,
  price numeric not null,
  deposit_value numeric default 30,
  active boolean default true
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id),
  name text,
  whatsapp text not null,
  cpf text,
  asaas_customer_id text,
  pix_auth_id text,
  auth_status text default 'pending',
  consent_at timestamp,
  consent_ip text
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id),
  customer_id uuid references public.customers(id),
  service_id uuid references public.services(id),
  start_at timestamp not null,
  end_at timestamp not null,
  status text default 'pending' check (status in ('pending','confirmed','showed','no_show','canceled')),
  asaas_payment_id text,
  deposit_paid boolean default false,
  created_at timestamp default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp default now(),
  business_id uuid references public.businesses(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  asaas_payment_id text,
  value numeric not null,
  status text default 'pending'
);

-- Permissões (anon só lê colunas seguras de businesses e services)
grant select (id, name, slug, whatsapp, logo_url) on public.businesses to anon;
grant select on public.services to anon;
grant select, insert, update, delete on public.businesses, public.services, public.customers, public.appointments, public.payments to authenticated;
grant all on public.businesses, public.services, public.customers, public.appointments, public.payments to service_role;

alter table public.businesses enable row level security;
alter table public.services enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.payments enable row level security;

create or replace function public.owns_business(_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.businesses where id = _business_id and owner_id = auth.uid())
$$;

-- businesses
create policy "public read businesses" on public.businesses for select to anon using (true);
create policy "owner read businesses" on public.businesses for select to authenticated using (owner_id = auth.uid());
create policy "owner insert businesses" on public.businesses for insert to authenticated with check (owner_id = auth.uid());
create policy "owner update businesses" on public.businesses for update to authenticated using (owner_id = auth.uid());

-- services
create policy "public read active services" on public.services for select to anon using (active = true);
create policy "owner all services" on public.services for all to authenticated
  using (public.owns_business(business_id)) with check (public.owns_business(business_id));

-- customers / appointments / payments
create policy "owner all customers" on public.customers for all to authenticated
  using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "owner all appointments" on public.appointments for all to authenticated
  using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "owner all payments" on public.payments for all to authenticated
  using (public.owns_business(business_id)) with check (public.owns_business(business_id));
