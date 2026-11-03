// Planos e limites: um lugar só, usado pelo servidor (para travar) e pela tela (para explicar).
export type PlanKey = "starter" | "pro";

export type PlanSpec = {
  name: string;
  price: number; // R$ por mês
  maxAppointmentsPerMonth: number | null; // null = ilimitado
  maxServices: number | null;
  maxProfessionals: number;
  reminder2h: boolean;
  birthday: boolean;
  reactivation: boolean;
  customFields: boolean;
  banner: boolean;
};

export const PLANS: Record<PlanKey, PlanSpec> = {
  starter: { name: "Starter", price: 49, maxAppointmentsPerMonth: 250, maxServices: 15, maxProfessionals: 1, reminder2h: false, birthday: false, reactivation: false, customFields: false, banner: false },
  pro: { name: "Pro", price: 99, maxAppointmentsPerMonth: null, maxServices: null, maxProfessionals: 5, reminder2h: true, birthday: true, reactivation: true, customFields: true, banner: true },
};

// Dias de tolerância depois do fim do teste ou do vencimento antes de bloquear novos agendamentos.
export const GRACE_DAYS = 3;
export const TRIAL_DAYS = 7;

export const FEATURE_LABEL: Record<"reminder2h" | "birthday" | "reactivation" | "customFields" | "banner", string> = {
  reminder2h: "Lembrete 2h antes",
  birthday: "Feliz aniversário automático",
  reactivation: "Reativação de clientes",
  customFields: "Campos personalizados",
  banner: "Banner na página de agendamento",
};
