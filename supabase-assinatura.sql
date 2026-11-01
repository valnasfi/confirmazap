-- ConfirmaZap - cobrança da mensalidade dos planos (Starter e Pro) pelo Asaas
-- Rode UMA vez no Supabase SQL Editor (depois do supabase-admin.sql).

alter table public.subscriptions add column if not exists asaas_subscription_id text;
alter table public.subscriptions add column if not exists asaas_customer_id text;
alter table public.subscriptions add column if not exists pending_plan text check (pending_plan in ('starter', 'pro'));
alter table public.subscriptions add column if not exists invoice_url text;

create unique index if not exists subscriptions_asaas_subscription_key
  on public.subscriptions (asaas_subscription_id) where asaas_subscription_id is not null;
