// Mensagem de aniversário: o texto é do profissional (settings.birthday.message); {nome} e {negocio} são trocados no envio.
export const DEFAULT_BIRTHDAY_MESSAGE = "Feliz aniversário, {nome}! 🎉 Toda a equipe da {negocio} deseja um dia muito especial para você.";

export type BirthdaySettings = { enabled?: boolean; message?: string; discountPercent?: number };

// Desconto de aniversário: vale por 7 dias, contando do dia do aniversário (datas em Brasília). Devolve o % ou 0.
export const BIRTHDAY_DISCOUNT_DAYS = 7;
export function birthdayDiscountPercent(birthDate: string | null | undefined, percent: number | undefined, nowMs = Date.now()) {
  const pct = Math.min(50, Math.max(0, Math.round(Number(percent) || 0)));
  if (!pct || !birthDate) return 0;
  const [, m, d] = String(birthDate).split("-").map(Number);
  if (!m || !d) return 0;
  const br = new Date(nowMs - 3 * 3600_000);
  const today = Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate());
  for (const y of [br.getUTCFullYear(), br.getUTCFullYear() - 1]) {
    const diff = Math.round((today - Date.UTC(y, m - 1, d)) / 86400_000);
    if (diff >= 0 && diff < BIRTHDAY_DISCOUNT_DAYS) return pct;
  }
  return 0;
}

export function renderBirthday(template: string, fullName: string | null, businessName: string) {
  const first = (fullName ?? "").trim().split(/\s+/)[0] || "cliente";
  const cap = first.charAt(0).toLocaleUpperCase("pt-BR") + first.slice(1).toLocaleLowerCase("pt-BR");
  return template.replace(/\{nome\}/gi, cap).replace(/\{negocio\}/gi, businessName);
}

// Reativação de clientes que sumiram (settings.reactivation). {link} leva à página de agendamento.
export const DEFAULT_REACTIVATION_MESSAGE = "Olá, {nome}! Sentimos sua falta na {negocio}. 😊 Que tal marcar um novo horário? {link}";
export const OPT_OUT_LINE = "Para não receber mais mensagens como esta, responda SAIR.";
export type ReactivationSettings = { enabled?: boolean; days?: number; message?: string };

export function renderReactivation(template: string, fullName: string | null, businessName: string, link: string) {
  const base = renderBirthday(template, fullName, businessName).replace(/\{link\}/gi, link);
  const withLink = /\{link\}/i.test(template) ? base : `${base} ${link}`;
  return /\bSAIR\b/.test(withLink) ? withLink : `${withLink}\n\n${OPT_OUT_LINE}`;
}

// Mensagem enviada quando o profissional marca falta (settings.noshow). {link} leva à página de agendamento.
export const DEFAULT_NOSHOW_MESSAGE = "Olá, {nome}! Sentimos sua falta no seu horário na {negocio}. 😕 Sem problema, a gente remarca: escolha um novo horário aqui {link}";
export type NoShowSettings = { enabled?: boolean; message?: string };
