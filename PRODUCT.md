# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Principal (quem assina):** o dono de qualquer negócio que atende com hora marcada: barbearias, salões, estética, saúde, consultórios, estúdios, aulas. Muitas vezes atende sozinho ou com uma equipe pequena (até 5 profissionais no Pro). A tarefa dele é manter a agenda cheia sem passar o dia mandando mensagem para cada cliente. Ele usa o painel (agenda, clientes, cobranças, configurações) tanto no celular, entre um atendimento e outro, quanto no computador do balcão, sem um dispositivo dominante.

**Secundário (cliente final):** a pessoa que agenda pelo link público do negócio (`/agendar/$slug`), paga o sinal por Pix e depois confirma, remarca ou cancela pelo link do WhatsApp (`/agendamento/$token`). Sem app e sem conta, quase sempre no celular.

**Interno:** o operador da plataforma, no painel `/admin` (cria negócios, gerencia planos).

## Product Purpose

Diminuir as faltas na agenda. O ReservaPix junta três mecanismos: agendamento online por link próprio, sinal por Pix que só confirma o horário depois do pagamento, e lembretes e avisos automáticos pelo WhatsApp do próprio negócio. Sucesso para o dono é menos cadeira vazia, mais comparecimento e menos trabalho manual. O painel mostra isso como faltas evitadas, valor protegido no mês e taxa de comparecimento.

## Positioning

O cliente se compromete pagando antes: o sinal por Pix cai na conta Asaas do negócio, e o horário só é confirmado quando o pagamento é identificado. As mensagens saem do número de WhatsApp do próprio negócio, conectado por QR Code, então o cliente reconhece o contato. Os lembretes, os avisos de falta, a reativação de clientes sumidos e o feliz aniversário rodam sozinhos.

## Operating Context

- Fluxo do cliente: escolhe serviço, profissional, dia e horário → paga o sinal por Pix → recebe a confirmação no WhatsApp → recebe o lembrete 24h antes (e 2h antes no Pro) → confirma, remarca ou cancela pelo link.
- Fluxo do dono: configura serviços (preço, duração, valor do sinal), profissionais, horário de funcionamento e dias fechados; acompanha a agenda; marca falta; devolve sinal (estorno Pix pelo Asaas); vê cobranças e clientes.
- Integrações: Supabase (auth e dados), Asaas (Pix e estorno), uazapi (WhatsApp), Kiwify (assinatura dos planos), crons para lembretes, aniversários e reativação.
- Projeto sincronizado com o Lovable: os commits na `main` voltam para o editor, então o branch precisa ficar sempre funcionando.

## Capabilities and Constraints

- Planos (`src/lib/plans.ts`): **Starter** R$49/mês (250 agendamentos/mês, 15 serviços, 1 profissional, lembrete 24h); **Pro** R$99/mês (ilimitado, até 5 profissionais, lembrete 2h, aniversário, reativação, campos personalizados, banner). Teste grátis de 7 dias com os recursos do Pro, sem cartão.
- Agendar e remarcar exigem pelo menos 4 horas de antecedência. O dono define até quantas horas antes o cancelamento é livre.
- Desconto de aniversário (Pro) só vale para cliente com CPF já cadastrado.
- LGPD: cada negócio só enxerga os próprios clientes, e documentos como CPF aparecem mascarados nas telas.
- Cancelamento da assinatura pelo próprio painel, sem multa.
- Stack: TanStack Start + React, Tailwind v4, shadcn/Radix, FullCalendar. Todo o produto é em português do Brasil.

## Brand Commitments

- Nome: **ReservaPix** (antes ConfirmaZap; o repositório ainda usa o nome antigo). Domínio: reservapix.vip. Logo e favicon em `public/logo.png`, `public/icon.png`, `public/favicon.ico`.
- Voz da landing atual: português direto e coloquial, falando do dinheiro perdido com falta ("Toda falta é dinheiro que você deixou na mesa", "Planos simples, sem pegadinha"). Sem jargão técnico.
- Rodapé da landing: "Feito com ❤ por VNF Digital" (definido pelo usuário em 2026-11-06).

## Evidence on Hand

- **Ainda não há prova real:** nenhum depoimento, nenhum cliente citável, nenhum número de faltas evitadas. O trabalho futuro não pode inventar depoimentos, logos de clientes, métricas ou contagem de usuários.
- O que existe: o próprio produto funcionando e as simulações da landing (agenda do hero, mini telas de /agendar, Pix e WhatsApp do salão fictício "Studio Bela"), sempre identificadas como "Simulação". A foto do avatar do Studio Bela (`public/landing/studio-bela-whatsapp.jpg`) foi fornecida pelo usuário.

## Product Principles

1. **Falar de dinheiro, não de software.** O valor é a cadeira que não fica vazia. Recursos se justificam pelo dinheiro que protegem.
2. **O cliente final resolve sozinho, em um toque.** Nada de app, cadastro ou ligação: link, Pix e resposta no WhatsApp.
3. **Automático por padrão.** Se o dono precisa lembrar de fazer, o produto falhou. Lembretes, avisos e reativação rodam sem ele.
4. **Funciona igual no celular e no balcão.** O painel precisa servir para uma olhada rápida entre atendimentos e também para uma tela aberta o dia todo.
5. **Honestidade antes de prova.** Sem números ou depoimentos inventados. As promessas ficam no que o produto faz de verdade.
