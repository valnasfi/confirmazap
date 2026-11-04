-- ReservaPix - desconto de aniversário. Rode UMA vez no Supabase SQL Editor.
alter table public.appointments add column if not exists discount_percent integer;
grant select on public.appointments to authenticated;
