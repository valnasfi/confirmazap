-- ConfirmaZap - painel de super admin
-- Rode no Supabase SQL Editor DEPOIS do supabase.sql.
-- Depois de rodar, cadastre seu usuário como admin (veja o final deste arquivo).

-- 1) Administradores da plataforma
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;
grant all on public.platform_admins to service_role;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

-- 2) Status do negócio (bloqueio)
alter table public.businesses
  add column if not exists status text not null default 'active' check (status in ('active', 'suspended')),
  add column if not exists suspended_reason text,
  add column if not exists suspended_at timestamptz;

grant select (status) on public.businesses to anon;

-- o dono não pode alterar status/bloqueio: só as colunas abaixo
revoke update on public.businesses from authenticated;
grant update (name, slug, whatsapp, logo_url, asaas_api_key, settings) on public.businesses to authenticated;

-- negócio suspenso deixa de ser público e o dono perde acesso aos dados
drop policy if exists "public read businesses" on public.businesses;
create policy "public read businesses" on public.businesses for select to anon using (status = 'active');

drop policy if exists "public read active services" on public.services;
create policy "public read active services" on public.services for select to anon
  using (active = true and exists (select 1 from public.businesses b where b.id = business_id and b.status = 'active'));

create or replace function public.owns_business(_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.businesses
    where id = _business_id and owner_id = auth.uid() and status = 'active'
  )
$$;

-- 3) Assinaturas
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  plan text not null default 'trial' check (plan in ('trial', 'starter', 'pro')),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled')),
  price numeric not null default 0,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon;
grant select, insert, update, delete on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

drop policy if exists "admin all subscriptions" on public.subscriptions;
create policy "admin all subscriptions" on public.subscriptions for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "owner read own subscription" on public.subscriptions;
create policy "owner read own subscription" on public.subscriptions for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

-- todo negócio novo começa com 7 dias de teste
create or replace function public.create_trial_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (business_id, plan, status, price, trial_ends_at)
  values (new.id, 'trial', 'trialing', 0, now() + interval '7 days')
  on conflict (business_id) do nothing;
  return new;
end
$$;
drop trigger if exists trg_business_trial on public.businesses;
create trigger trg_business_trial after insert on public.businesses
  for each row execute function public.create_trial_subscription();

-- negócios que já existem também ganham uma assinatura de teste
insert into public.subscriptions (business_id, plan, status, price, trial_ends_at)
select id, 'trial', 'trialing', 0, created_at + interval '7 days' from public.businesses
on conflict (business_id) do nothing;

-- 4) Funções do painel (só o super admin consegue usar)
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select jsonb_build_object(
    'businesses_total', (select count(*) from public.businesses),
    'businesses_active', (select count(*) from public.businesses where status = 'active'),
    'businesses_suspended', (select count(*) from public.businesses where status = 'suspended'),
    'new_businesses_30d', (select count(*) from public.businesses where created_at >= now() - interval '30 days'),
    'subs_trialing', (select count(*) from public.subscriptions where status = 'trialing'),
    'subs_active', (select count(*) from public.subscriptions where status = 'active'),
    'subs_past_due', (select count(*) from public.subscriptions where status = 'past_due'),
    'subs_canceled', (select count(*) from public.subscriptions where status = 'canceled'),
    'trials_ending_7d', (select count(*) from public.subscriptions where status = 'trialing' and trial_ends_at between now() and now() + interval '7 days'),
    'mrr', (select coalesce(sum(price), 0) from public.subscriptions where status = 'active'),
    'customers_total', (select count(*) from public.customers),
    'appointments_30d', (select count(*) from public.appointments where start_at >= now() - interval '30 days'),
    'showed_30d', (select count(*) from public.appointments where status = 'showed' and start_at >= now() - interval '30 days'),
    'no_show_30d', (select count(*) from public.appointments where status = 'no_show' and start_at >= now() - interval '30 days'),
    'deposits_recovered', (select coalesce(sum(s.deposit_value), 0) from public.appointments a join public.services s on s.id = a.service_id where a.deposit_paid),
    'signups_6m', (
      select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m.month, 'YYYY-MM'), 'count', m.cnt) order by m.month), '[]'::jsonb)
      from (
        select gs.month, (select count(*) from public.businesses b where date_trunc('month', b.created_at) = gs.month) as cnt
        from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') as gs(month)
      ) m
    )
  ) into r;
  return r;
end
$$;

create or replace function public.admin_list_businesses()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb) into r
  from (
    select b.created_at, jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'slug', b.slug,
      'whatsapp', b.whatsapp,
      'status', b.status,
      'suspended_reason', b.suspended_reason,
      'created_at', b.created_at,
      'owner_email', u.email,
      'last_sign_in_at', u.last_sign_in_at,
      'plan', s.plan,
      'sub_status', s.status,
      'price', s.price,
      'trial_ends_at', s.trial_ends_at,
      'current_period_end', s.current_period_end,
      'customers_count', (select count(*) from public.customers c where c.business_id = b.id),
      'appointments_30d', (select count(*) from public.appointments a where a.business_id = b.id and a.start_at >= now() - interval '30 days'),
      'no_show_30d', (select count(*) from public.appointments a where a.business_id = b.id and a.status = 'no_show' and a.start_at >= now() - interval '30 days'),
      'last_appointment_at', (select max(a.start_at) from public.appointments a where a.business_id = b.id)
    ) as j
    from public.businesses b
    left join auth.users u on u.id = b.owner_id
    left join public.subscriptions s on s.business_id = b.id
  ) x;
  return r;
end
$$;

create or replace function public.admin_set_business_status(_business_id uuid, _suspend boolean, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.businesses
  set status = case when _suspend then 'suspended' else 'active' end,
      suspended_reason = case when _suspend then _reason else null end,
      suspended_at = case when _suspend then now() else null end
  where id = _business_id;
end
$$;

revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.admin_list_businesses() from public, anon;
revoke execute on function public.admin_set_business_status(uuid, boolean, text) from public, anon;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_list_businesses() to authenticated;
grant execute on function public.admin_set_business_status(uuid, boolean, text) to authenticated;

-- 5) Depois de rodar tudo acima (e depois de criar a conta no ConfirmaZap com este
-- e-mail), rode este bloco separado para cadastrar o super admin.
-- Ele acusa erro se a conta ainda não existir:
--
-- do $$
-- begin
--   insert into public.platform_admins (user_id)
--   select id from auth.users where email = 'contato@valdinascimento.com.br'
--   on conflict do nothing;
--   if not exists (
--     select 1 from public.platform_admins p join auth.users u on u.id = p.user_id
--     where u.email = 'contato@valdinascimento.com.br'
--   ) then
--     raise exception 'Conta contato@valdinascimento.com.br não encontrada: crie a conta no ConfirmaZap primeiro';
--   end if;
-- end $$;
