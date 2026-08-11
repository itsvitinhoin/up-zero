export { getDefaultSignWholesale } from '@/lib/sign-wholesale-defaults'

export function getDefaultAnnouncementBar() {
  return {
    enabled: true,
    items: [
      "Frete gratis para compras acima de R$ 1000",
      "Novidades toda semana",
      "Atacado exclusivo para lojistas",
    ],
    separator: "|",
    backgroundColor: "#1a1a1a",
    textColor: "#ffffff",
    isAnimated: true,
    animationSpeed: "NORMAL" as const,
  };
}

export function getDefaultPopupCoupon() {
  return {
    enabled: false,
    imageUrl: null,
    couponCode: "",
    applyButtonText: "Aplicar cupom",
  };
}

export function getDefaultInfoBanners() {
  return {
    pedidoMinimo: { isActive: true, icon: "package" as const, title: "Pedido Minimo", description: "A partir de 6 pecas" },
    entrega: { isActive: true, icon: "truck" as const, title: "Entrega", description: "Para todo o Brasil" },
    pagamento: { isActive: true, icon: "credit-card" as const, title: "Pagamento", description: "Ate 6x sem juros" },
    atendimento: { isActive: true, icon: "users" as const, title: "Atendimento", description: "Vendedora exclusiva" },
  };
}
