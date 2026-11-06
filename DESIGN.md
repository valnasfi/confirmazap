---
name: ReservaPix
description: Agendamento com sinal por Pix e lembretes no WhatsApp, para acabar com as faltas na agenda.
colors:
  primary: "oklch(0.52 0.13 160)"
  primary-foreground: "oklch(0.99 0.01 150)"
  accent: "oklch(0.88 0.17 125)"
  accent-foreground: "oklch(0.22 0.05 150)"
  ink: "oklch(0.24 0.05 168)"
  ink-foreground: "oklch(0.96 0.03 140)"
  ink-raised: "oklch(0.32 0.06 165)"
  background: "oklch(0.975 0.012 150)"
  foreground: "oklch(0.22 0.04 165)"
  card: "oklch(1 0 0)"
  secondary: "oklch(0.93 0.03 150)"
  secondary-foreground: "oklch(0.25 0.05 165)"
  muted: "oklch(0.94 0.015 150)"
  muted-foreground: "oklch(0.48 0.03 165)"
  border: "oklch(0.89 0.02 155)"
  destructive: "oklch(0.58 0.21 27)"
  status-pending: "oklch(0.83 0.16 85)"
  status-confirmed: "oklch(0.62 0.15 150)"
  status-showed: "oklch(0.55 0.12 230)"
  status-noshow: "oklch(0.6 0.21 27)"
  status-canceled: "oklch(0.65 0.01 160)"
typography:
  display:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.02em"
  figure:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
rounded:
  sm: "10px"
  md: "12px"
  lg: "14px"
  xl: "18px"
  2xl: "22px"
  3xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "32px"
  section: "80px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-cta:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "14px 24px"
  button-cta-ghost:
    textColor: "{colors.ink-foreground}"
    rounded: "{rounded.xl}"
    padding: "14px 24px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  card-highlight:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-foreground}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  status-pill:
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  sidebar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-foreground}"
    width: "240px"
    padding: "20px"
  sidebar-item-active:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.ink-foreground}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
---

# Design System: ReservaPix

## Overview

**Creative North Star: "A Agenda que Não Vaza"**

O ReservaPix passa a sensação de agenda segura: fundos verde-floresta quase pretos (ink) dão peso e confiança, e o verde-limão aparece só onde há dinheiro ou uma ação que protege dinheiro. O verde do Pix é a cor de trabalho do painel. Tudo fica em uma família de verdes frios. Não existe uma segunda cor de marca, e o vermelho fica reservado para falta e erro.

O sistema tem dois registros. A **landing** é ousada: hero com gradiente ink, títulos grandes em Sora, CTAs em limão, cards arredondados com sombra esverdeada. O **painel** é preciso e contido: tipografia menor, botões compactos do shadcn, cards brancos sobre fundo menta claro, e o ink só como sidebar e como card de destaque para o número que mais importa. A ousadia da landing não vaza para o painel.

A densidade do painel é média: grades de cards de métrica (2 colunas no tablet, 4 ou 5 no desktop), listas divididas por linha dentro de um card, e números grandes em Sora para valores em reais. O painel não tem modo escuro. As superfícies escuras são escolhas de composição (sidebar, cards de destaque, seções da landing), não um tema.

**Key Characteristics:**
- Família única de verdes frios (matiz 125–170) do ink ao fundo menta.
- Limão (accent) como sinal de dinheiro e ação principal, nunca como fundo de área grande no painel.
- Sora para títulos e números, Manrope para tudo o que se lê.
- Landing ousada, painel contido: o mesmo vocabulário em dois volumes.
- Status de agendamento com cinco cores próprias, sempre em pílula translúcida.

## Colors

Uma paleta monocromática de verdes frios com um limão vivo de destaque e cores de status separadas.

### Primary
- **Verde Pix** (`primary`): botão padrão do painel, ícones de recurso, checks da lista do Starter, anel de foco, botões do calendário em hover. É a cor da ação comum: salvar, criar, confirmar.

### Secondary
- **Limão Caixa** (`accent`): CTA "Teste grátis" sobre fundos ink, aviso "Pix recebido" do hero, selo "Mais completo", valores em reais em destaque (preço do Pro), palavras-chave do título do hero, item ativo da sidebar no tema shadcn e fundo do dia atual no calendário (18% de mistura). Texto sobre ele sempre em `accent-foreground`.

### Tertiary
- **Floresta Noturna** (`ink`): sidebar do painel, nav e barra fixa do celular na landing, seção "Como funciona", CTA "Teste grátis" sobre fundos claros, moldura dos celulares simulados, card do plano Pro e cards de métrica em destaque (`hi`). **Floresta Elevada** (`ink-raised`) é o hover e o estado ativo dentro das áreas ink.

### Neutral
- **Menta Névoa** (`background`): fundo de todas as páginas.
- **Branco Card** (`card`): cards, listas, popovers.
- **Verde Tinta** (`foreground`): texto principal. Nunca preto puro.
- **Menta Suave** (`secondary`, `muted`): item ativo da nav do celular, blocos de aviso, campos somente leitura.
- **Musgo Cinza** (`muted-foreground`): texto de apoio, descrições, rótulos de métrica.
- **Linha Menta** (`border`): bordas de campos, divisórias de lista, bordas do calendário.

### Status
- **Pendente** (`status-pending`, âmbar), **Confirmado** (`status-confirmed`, verde), **Compareceu** (`status-showed`, azul), **Falta** (`status-noshow`, vermelho), **Cancelado** (`status-canceled`, cinza). Usados como fundo da pílula a 20% (cancelado a 25%) com texto `foreground`, e na cor cheia nos eventos do calendário.
- **Erro** (`destructive`): mensagens de erro, ações destrutivas (devolver sinal, cancelar).

### Named Rules
**The Lime Means Money Rule.** O limão marca dinheiro ou a ação que protege dinheiro: CTA de cadastro, preço, valor perdido, valor protegido. Ele não é usado como enfeite, em texto de corpo ou em fundo de área grande clara.

**The One Ink Card Rule.** Em cada grade de métricas do painel, só um card fica em ink: o número que responde "quanto dinheiro" (sinais recebidos, faltas evitadas, total do dia). Os outros ficam em branco.

**The Status Is Sacred Rule.** As cinco cores de status são exclusivas do ciclo do agendamento. Não use o âmbar para alertas genéricos nem o azul para links.

## Typography

**Display Font:** Sora (com ui-sans-serif, system-ui)
**Body Font:** Manrope (com ui-sans-serif, system-ui)

**Character:** Sora é geométrica e firme, com tracking apertado (-0.02em), e dá autoridade a títulos e valores em reais. Manrope é aberta e legível em telas pequenas, e cuida de todo o texto que se lê.

### Hierarchy
- **Display** (700, 2.6rem no celular → 4.25rem no desktop, line-height 1.02, tracking -0.03em): título do hero e do CTA final da landing.
- **Headline** (700, 1.875rem → 2.25rem): títulos de seção da landing; o título "Olá, {negócio}" do painel usa 1.875rem.
- **Title** (600, 1.25rem): títulos de seção do painel ("Faltas evitadas no mês", "Hoje") e títulos de card.
- **Figure** (Sora 700, 1.875rem nas métricas principais, 1.5rem nas secundárias, 3rem nos preços): números e valores em reais. Sempre Sora.
- **Body** (Manrope 400, 1rem; 1.125rem no subtítulo do hero, até cerca de 36rem de largura): parágrafos.
- **Body small** (Manrope 400, 0.875rem): descrições, rótulos de métrica, itens de nav, botões do painel.
- **Label** (Manrope 500, 0.75rem): pílulas de status, legendas, notas de rodapé dos cards.

### Named Rules
**The Numbers Wear Sora Rule.** Todo valor que o dono do negócio olha para decidir (contagem, porcentagem, R$) é Sora em negrito, maior que o rótulo. O rótulo fica acima, em body small a 70% de opacidade.

## Layout

- **Container:** máximo de 72rem (`max-w-6xl`) para a landing e o painel; 64rem para preços; 42rem para a página pública de agendamento.
- **Gutter:** 20px no celular; o conteúdo do painel ganha 32px de padding a partir de 768px.
- **Ritmo:** seções da landing com 80px de padding vertical; títulos de seção do painel com 40px acima e 12px até o conteúdo; cards de métrica com 16px de gap.
- **Grades:** cards de métrica em 1 → 2 (640px) → 4 ou 5 colunas (1024px). Recursos da landing em linhas alternadas de texto e mini tela (1 → 2 colunas a 768px). Hero em duas colunas (texto e agenda de até 30rem) a partir de 768px; no celular a ordem é título, agenda e botão.
- **Painel responsivo:** a sidebar ink de 240px aparece a partir de 768px. Abaixo disso vira uma faixa horizontal rolável de links no topo, em fundo `card`.
- **Landing no celular:** barra fixa no rodapé com o CTA em largura total, sobre ink a 95% com desfoque; ela só aparece depois que o botão do hero sai da tela. O "Teste grátis" do topo fica visível em todas as larguras.
- **Página pública:** hero ink com o logo e o nome do negócio, e os cards brancos sobem 40px por cima do hero.

## Elevation & Depth

Sistema híbrido: a profundidade vem principalmente de camadas de tom (branco sobre menta, ink sobre menta), reforçada por uma única sombra própria, verde e difusa, que levanta os cards. Os componentes shadcn trazem as sombras padrão pequenas (`shadow-sm`, `shadow`) em botões e campos.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 0 color-mix(in oklab, var(--foreground) 6%, transparent), 0 12px 30px -18px color-mix(in oklab, var(--primary) 45%, transparent)`): todos os cards do produto, da landing, do painel e da página pública. Uma linha fina embaixo mais um brilho verde difuso.
- **CTA** (`shadow-lg` com preto a 20%): só os botões limão sobre ink na landing.
- **Agenda do hero** (`0 30px 60px -30px` preto a 55%): só o painel de agenda simulado que atravessa a borda do hero.
- **Celular simulado** (`0 30px 60px -28px` preto a 55%, mais contorno interno de 1.5px): moldura no formato de iPhone das mini telas de recursos.

### Named Rules
**The Green Glow Rule.** Card levantado usa `shadow-card`, nunca uma sombra cinza genérica. A sombra carrega o matiz do primary.

## Shapes

Cantos generosos e consistentes, derivados de um raio base de 14px (`--radius: 0.875rem`). Os controles do painel ficam em 12px; cards em 22px; cards grandes de preço em 24px; painel da agenda do hero em 22px; moldura do celular simulado em 48px; pílulas e selos totalmente redondos. Bordas são finas (1px, `border`) e quase só aparecem em campos e divisórias. Os cards se separam pela sombra, não pela borda. A exceção é o botão de contorno do Starter, com borda de 2px em `primary`.

## Components

### Buttons
Precisos no painel, ousados na landing.
- **Shape:** 12px no painel (`rounded-md`, que neste tema vale 12px); 18px nos CTAs da landing.
- **Primary (painel):** Verde Pix com texto claro, 36px de altura, 16px de padding lateral, Manrope 500 a 0.875rem. Hover a 90% de opacidade.
- **Outline / Secondary / Ghost (painel):** contorno em `border` sobre o fundo; hover passa para o fundo limão (comportamento padrão do shadcn).
- **CTA "Teste grátis" (landing):** mínimo de 48px de altura, raio de 18px, Manrope 700 a 1rem, seta à direita que anda 2px no hover. Sobre ink: limão com texto `accent-foreground`, sombra preta suave, hover com `brightness(1.1)`. Sobre fundos claros: ink com texto claro e seta limão (limão some sobre o menta). Abaixo dele, a nota "7 dias grátis com tudo do Pro. Sem cartão."
- **Focus:** anel de 1px na cor `ring` (Verde Pix).

### Status Pills
- **Style:** totalmente redonda, 4px × 12px, Manrope 500 a 0.75rem, texto `foreground` sobre a cor de status a 20%.
- **Uso:** à direita de cada linha de agendamento e na lista de cobranças.

### Cards / Containers
- **Corner Style:** 22px (painel e agenda do hero), 24px (preço), 28px (fundo das mini telas).
- **Background:** `card` em branco; `ink` para o único card de destaque.
- **Shadow Strategy:** sempre `shadow-card` (ver Elevation & Depth).
- **Border:** nenhuma; o plano Pro tem anel de 2px em limão.
- **Internal Padding:** 20px nos cards de métrica e recurso; 28px nos de preço; 24px na página pública.
- **Hover:** nenhum card sobe; a interação fica nos botões.

### Inputs / Fields
- **Style:** 36px de altura, borda de 1px em `input`, raio de 12px, fundo transparente ou `background`, texto 1rem no celular (evita zoom) e 0.875rem a partir de 768px.
- **Focus:** anel de 1px em Verde Pix.
- **Read-only:** fundo `muted` com texto `muted-foreground`.
- **Error:** mensagem em `destructive` a 0.875rem logo abaixo do campo.

### Navigation
- **Sidebar (painel, ≥768px):** fundo ink, 240px, logo claro no topo, itens em 0.875rem com ícone de 16px a 80% de opacidade; hover e ativo com `ink-raised`, e o ativo em negrito e opacidade total. No rodapé: nome do negócio, link público e "Sair".
- **Celular:** faixa de links rolável na horizontal, em fundo `card`; o ativo ganha fundo `secondary` e negrito.
- **Landing:** header fixo em ink a 90% com desfoque, links a 80% de opacidade, "Entrar" como texto e "Testar grátis" como CTA limão compacto.

### Metric Card (signature)
O componente que mais define o painel. Rótulo em body small a 70% de opacidade, valor em Sora 700 (1.875rem ou 1.5rem), nota opcional em label a 70%. Branco por padrão; em ink quando é o número de dinheiro da grade (The One Ink Card Rule).

### Agenda Calendar
FullCalendar (`timeGrid`) a 0.85rem, bordas em `border`, botões em ink com hover e ativo em Verde Pix, dia atual com limão a 18%. Os eventos usam a cor cheia do status.

## Do's and Don'ts

### Do:
- **Do** usar os tokens do `src/styles.css` (`bg-primary`, `bg-ink`, `bg-accent`, `shadow-card`, `bg-st-*`) em vez de cores soltas; as exceções hoje são a moldura e o fundo do chat dos celulares simulados da landing.
- **Do** manter o painel no volume contido: botões de 36px, títulos de seção a 1.25rem, cards brancos com `shadow-card`.
- **Do** escrever todo valor em reais e toda métrica em Sora 700, com o rótulo menor acima.
- **Do** reservar o limão para dinheiro e para a ação principal (The Lime Means Money Rule).
- **Do** usar a pílula de status com a cor do status a 20% e texto `foreground` sempre que mostrar um agendamento.
- **Do** manter campos a 1rem no celular para não dar zoom no iOS.

### Don't:
- **Don't** trazer o volume da landing (títulos de 3.75rem, CTAs limão de 18px, gradiente do hero) para dentro do painel.
- **Don't** colocar mais de um card ink em uma mesma grade de métricas.
- **Don't** usar as cores de status (âmbar, azul, vermelho, cinza) para algo fora do ciclo do agendamento.
- **Don't** usar preto puro para texto ou sombra cinza neutra em cards; o texto é Verde Tinta e a sombra do card é verde.
- **Don't** introduzir uma segunda cor de marca fora da família verde.
- **Don't** adicionar modo escuro como tema global; as superfícies escuras são composição, não tema.
