-- ReservaPix - assinaturas vendidas pela Kiwify. Rode UMA vez no Supabase SQL Editor.
alter table public.subscriptions add column if not exists kiwify_subscription_id text;

create table if not exists public.kiwify_pending (
  email text primary key,
  plan text not null check (plan in ('starter', 'pro')),
  status text not null default 'active',
  period_end timestamptz,
  kiwify_subscription_id text,
  updated_at timestamptz not null default now()
);
alter table public.kiwify_pending enable row level security;
revoke all on public.kiwify_pending from anon, authenticated;
grant all on public.kiwify_pending to service_role;
