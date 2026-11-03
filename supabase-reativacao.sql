-- ReservaPix - reativar clientes sumidos + opção SAIR
-- Rode UMA vez no Supabase SQL Editor (depois do supabase-lembretes.sql).

-- 1) Quem respondeu SAIR não recebe aniversário nem "sentimos sua falta"
alter table public.customers add column if not exists marketing_opt_out boolean not null default false;

-- 2) Registro dos envios (no máximo um por cliente por dia). Fechado ao navegador.
create table if not exists public.reactivation_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  sent_on date not null,
  sent_at timestamptz not null default now(),
  unique (customer_id, sent_on)
);
create index if not exists reactivation_messages_business_sent_idx on public.reactivation_messages (business_id, sent_at);
alter table public.reactivation_messages enable row level security;
revoke all on public.reactivation_messages from anon, authenticated;
grant all on public.reactivation_messages to service_role;

-- 3) Agendador: de hora em hora (o app só envia entre 10h e 19h de Brasília)
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'confirmazap-reativacao',
  '30 * * * *',
  $$ select net.http_post(
       url := 'https://reservapix.vip/api/cron/reactivation',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb,
       timeout_milliseconds := 30000
     ) $$
);
