-- ReservaPix - dados do estabelecimento (e-mail, telefone, CPF/CNPJ)
-- Rode no Supabase SQL Editor. As colunas ficam privadas: o público (anon) não consegue ler.

alter table public.businesses add column if not exists email text;
alter table public.businesses add column if not exists phone text;
alter table public.businesses add column if not exists document text;

-- O dono pode preencher e editar os próprios dados.
grant update (email, phone, document) on public.businesses to authenticated;
