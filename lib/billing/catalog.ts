/** Commercial prices in BRL cents. */
export const BILLING_PRICES = {
  starterMonthly: 89900,
  proMonthly: 119900,
  whatsappNumberMonthly: 9900,
  studioGeneration: 1000,
  imagesPerGeneration: 4,
} as const;

export const STARTER_FEATURES = [
  "Vendedoras ilimitadas",
  "E-mails transacionais",
  "Suporte via WhatsApp",
  "Produtos ilimitados",
  "Integração com ERP: produtos, estoque e pedidos",
  "Template padrão",
  "Integração com os Correios",
  "Integração com gateways de pagamento: Getnet, Redecard, Pagarme e outros",
  "Mapa de revendedores",
];
export const PRO_FEATURES = ["Tudo do Starter B2B", "Módulo Offline", "Módulo B2C2B", "Módulo Studio"];
export type CommercialPlan = "plan_starter" | "plan_profissional";

export function estimateBilling(plan: CommercialPlan, numbers: number, generations: number) {
  if (![numbers, generations].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000)) {
    throw new Error("Informe quantidades inteiras entre 0 e 1.000.000.");
  }
  const subscription = plan === "plan_starter" ? BILLING_PRICES.starterMonthly : BILLING_PRICES.proMonthly;
  const whatsapp = numbers * BILLING_PRICES.whatsappNumberMonthly;
  const studio = generations * BILLING_PRICES.studioGeneration;
  return { subscription, whatsapp, studio, addons: whatsapp + studio, total: subscription + whatsapp + studio };
}

export const formatBRL = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
