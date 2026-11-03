-- ReservaPix - clientes sem duplicidade + cadastro completo
-- Rode UMA vez no Supabase SQL Editor.

-- 1) Campos novos do cadastro do cliente
alter table public.customers add column if not exists email text;
alter table public.customers add column if not exists birth_date date;
alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists notes text;

-- 2) Padroniza: só números no WhatsApp e no CPF (vazio vira nulo)
update public.customers set whatsapp = regexp_replace(whatsapp, '\D', '', 'g') where whatsapp ~ '\D';
update public.customers set cpf = nullif(regexp_replace(cpf, '\D', '', 'g'), '') where cpf is not null and cpf ~ '\D' or cpf = '';

-- 3) Junta os duplicados que já existem (mesmo negócio + mesmo WhatsApp, depois mesmo CPF): fica o cadastro
--    que já tem Asaas, e os agendamentos e pagamentos dos repetidos passam para ele.
--    Tudo num bloco só: o editor do Supabase pode trocar de conexão entre comandos, e a tabela temporária some.
do $$
declare k text;
begin
  foreach k in array array['whatsapp', 'cpf'] loop
    drop table if exists _dup;
    execute format($f$
      create temp table _dup as
      select id as dup_id,
             first_value(id) over (partition by business_id, %1$I order by (asaas_customer_id is not null) desc, id) as keep_id
      from public.customers where %1$I is not null
    $f$, k);
    delete from _dup where dup_id = keep_id;
    update public.appointments a set customer_id = d.keep_id from _dup d where a.customer_id = d.dup_id;
    update public.payments p set customer_id = d.keep_id from _dup d where p.customer_id = d.dup_id;
    delete from public.customers c using _dup d where c.id = d.dup_id;
    drop table _dup;
  end loop;
end $$;

-- 5) Trava no banco: não existe mais dois clientes iguais no mesmo negócio
create unique index if not exists customers_business_whatsapp_key on public.customers (business_id, whatsapp);
create unique index if not exists customers_business_cpf_key on public.customers (business_id, cpf) where cpf is not null;

-- 6) Campos personalizados do cliente (valores ficam em "extra"; os campos são criados em Clientes > Campos personalizados)
alter table public.customers add column if not exists extra jsonb not null default '{}'::jsonb;

-- 7) Campo Sexo no cadastro do cliente
alter table public.customers add column if not exists sex text;
