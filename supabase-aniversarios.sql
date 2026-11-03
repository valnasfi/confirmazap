-- ReservaPix - mensagem de aniversário automática
-- Rode UMA vez no Supabase SQL Editor (depois do supabase-whatsapp.sql e do supabase-clientes.sql).

-- 1) Registro de quem já recebeu (um por cliente por ano). Fechado ao navegador: só o servidor usa.
create table if not exists public.birthday_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  year int not null,
  sent_at timestamptz not null default now(),
  unique (customer_id, year)
);
alter table public.birthday_messages enable row level security;
revoke all on public.birthday_messages from anon, authenticated;
grant all on public.birthday_messages to service_role;

-- 2) Agendador: de hora em hora o Supabase chama o app, que envia as mensagens do dia (a partir das 9h de Brasília).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'confirmazap-aniversarios',
  '0 * * * *',
  $$ select net.http_post(
       url := 'https://reservapix.vip/api/cron/birthdays',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb,
       timeout_milliseconds := 30000
     ) $$
);
