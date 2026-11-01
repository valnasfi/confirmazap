// Mensagem de aniversário: o texto é do profissional (settings.birthday.message); {nome} e {negocio} são trocados no envio.
export const DEFAULT_BIRTHDAY_MESSAGE = "Feliz aniversário, {nome}! 🎉 Toda a equipe da {negocio} deseja um dia muito especial para você.";

export type BirthdaySettings = { enabled?: boolean; message?: string };

export function renderBirthday(template: string, fullName: string | null, businessName: string) {
  const first = (fullName ?? "").trim().split(/\s+/)[0] || "cliente";
  const cap = first.charAt(0).toLocaleUpperCase("pt-BR") + first.slice(1).toLocaleLowerCase("pt-BR");
  return template.replace(/\{nome\}/gi, cap).replace(/\{negocio\}/gi, businessName);
}
