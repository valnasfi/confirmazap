// Mensagem de aniversário: o texto é do profissional (settings.birthday.message); {nome} e {negocio} são trocados no envio.
export const DEFAULT_BIRTHDAY_MESSAGE = "Feliz aniversário, {nome}! 🎉 Toda a equipe da {negocio} deseja um dia muito especial para você.";

export type BirthdaySettings = { enabled?: boolean; message?: string };

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
