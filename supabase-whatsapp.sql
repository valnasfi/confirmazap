-- ConfirmaZap - conexão do WhatsApp (uazapi)
-- Rode no Supabase SQL Editor (depois dos outros arquivos .sql).
-- A tabela guarda o token da instância de cada negócio, por isso fica FECHADA para o navegador:
-- RLS ligado e nenhuma policy. Só o servidor (service role) lê e escreve.

create table if not exists public.whatsapp_connections (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  instance_name text not null,
  instance_token text not null,
  status text not null default 'disconnected',
  phone text,
  profile_name text,
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_connections enable row level security;
revoke all on public.whatsapp_connections from anon, authenticated;
grant all on public.whatsapp_connections to service_role;
