-- ReservaPix - lembretes por WhatsApp, confirmação por resposta e link para cancelar/remarcar
-- Rode UMA vez no Supabase SQL Editor (depois do supabase-whatsapp.sql e do supabase-aniversarios.sql).

-- 1) Cada agendamento ganha um link secreto próprio (usado em /agendamento/<token>)
alter table public.appointments add column if not exists manage_token text;
update public.appointments
  set manage_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  where manage_token is null;
alter table public.appointments alter column manage_token
  set default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
create unique index if not exists appointments_manage_token_key on public.appointments (manage_token);

-- 2) Quando o cliente respondeu "1" (confirmou presença)
alter table public.appointments add column if not exists customer_confirmed_at timestamptz;

-- 3) Registro de lembretes enviados (um por agendamento e tipo). Fechado ao navegador.
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('24h', '2h')),
  sent_at timestamptz not null default now(),
  unique (appointment_id, kind)
);
alter table public.reminders enable row level security;
revoke all on public.reminders from anon, authenticated;
grant all on public.reminders to service_role;

-- 4) Agendador: a cada 15 minutos o Supabase chama o app, que envia os lembretes que estão na hora
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'confirmazap-lembretes',
  '*/15 * * * *',
  $$ select net.http_post(
       url := 'https://reservapix.vip/api/cron/reminders',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb,
       timeout_milliseconds := 30000
     ) $$
);
