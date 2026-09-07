import type { MegaMenuEditorialItem, MegaMenuEditorialKey, SiteCustomization } from '@/lib/types'

export type StorefrontTemplateKey = 'classic' | 'groovy'
export type TemplateCapabilityState = 'optional' | 'required' | 'unsupported'

export type StorefrontTemplateCapability =
  | 'announcementBar'
  | 'megaMenu'
  | 'videoHero'
  | 'benefitsBar'
  | 'twoBannerGrid'
  | 'productCarousels'
  | 'threeCategoryBannerGrid'
  | 'productCardImageNavigation'
  | 'productCardColorLimit'
  | 'productPageColorLimit'
  | 'productSkuCopy'
  | 'resellerCallout'
  | 'editorialFooter'
  | 'footerQrCode'
  | 'popupCoupon'

export interface StorefrontTemplateDefinition {
  key: StorefrontTemplateKey
  name: string
  version: number
  description: string
  previewStoreId?: number
  highlights: string[]
  capabilities: Record<StorefrontTemplateCapability, TemplateCapabilityState>
}

export const GROOVY_ANNOUNCEMENTS = [
  { text: 'PEDIDO MÍNIMO: 12 PEÇAS.', ctaText: 'MONTE SEU MIX', url: '/produtos' },
  { text: 'FRETE GRÁTIS ACIMA DE R$ 1.000,00', ctaText: null, url: '/produtos' },
  { text: 'REPOSIÇÕES DISPONÍVEIS', ctaText: 'CONFIRA', url: '/produtos?q=reposicao' },
]

export const GROOVY_MEGA_MENU_EDITORIAL: Record<MegaMenuEditorialKey, MegaMenuEditorialItem> = {
  newArrivals: {
    imageUrl: '/mega-menu/new-drop.png',
    eyebrow: 'Drop atual',
    title: 'New drop',
    description: null,
    ctaText: 'Ver lançamento',
    href: '/produtos?sort=newest',
  },
  clothing: {
    imageUrl: '/mega-menu/new-collection.png',
    eyebrow: 'Destaque',
    title: 'Nova coleção',
    description: null,
    ctaText: 'Descubra',
    href: '/produtos',
  },
  bestSellers: {
    imageUrl: '/mega-menu/best-sellers.png',
    eyebrow: 'Curadoria',
    title: 'Mais vendidos',
    description: null,
    ctaText: 'Ver seleção',
    href: '/produtos?sort=sort',
  },
  restocks: {
    imageUrl: '/mega-menu/restock.png',
    eyebrow: "They're back",
    title: 'Os favoritos estão de volta.',
    description: null,
    ctaText: 'Ver reposições',
    href: '/produtos?q=reposicao',
  },
}

export const STOREFRONT_TEMPLATES: Record<StorefrontTemplateKey, StorefrontTemplateDefinition> = {
  classic: {
    key: 'classic',
    name: 'Clássico',
    version: 1,
    description: 'Estrutura padrão da vitrine.',
    highlights: ['Layout padrão', 'Banners em imagem', 'Faixa de benefícios'],
    capabilities: {
      announcementBar: 'optional',
      megaMenu: 'optional',
      videoHero: 'unsupported',
      benefitsBar: 'optional',
      twoBannerGrid: 'optional',
      productCarousels: 'optional',
      threeCategoryBannerGrid: 'unsupported',
      productCardImageNavigation: 'unsupported',
      productCardColorLimit: 'optional',
      productPageColorLimit: 'optional',
      productSkuCopy: 'optional',
      resellerCallout: 'optional',
      editorialFooter: 'unsupported',
      footerQrCode: 'optional',
      popupCoupon: 'optional',
    },
  },
  groovy: {
    key: 'groovy',
    name: 'Groovy',
    version: 1,
    description: 'Template editorial para atacado com mega menu, vídeo e vitrines de categoria.',
    previewStoreId: 1043,
    highlights: ['Hero em vídeo', 'Mega menu editorial', 'Cards com navegação e cores'],
    capabilities: {
      announcementBar: 'required',
      megaMenu: 'required',
      videoHero: 'optional',
      benefitsBar: 'unsupported',
      twoBannerGrid: 'required',
      productCarousels: 'required',
      threeCategoryBannerGrid: 'required',
      productCardImageNavigation: 'required',
      productCardColorLimit: 'required',
      productPageColorLimit: 'required',
      productSkuCopy: 'required',
      resellerCallout: 'required',
      editorialFooter: 'required',
      footerQrCode: 'unsupported',
      popupCoupon: 'optional',
    },
  },
}

export function applyStorefrontTemplateDefaults(
  customization: SiteCustomization,
  key: StorefrontTemplateKey,
  publishedAt: string,
): SiteCustomization {
  const definition = STOREFRONT_TEMPLATES[key]
  const isGroovy = key === 'groovy'

  return {
    ...customization,
    templateKey: key,
    templateVersion: definition.version,
    templateInstalledAt: customization.templateKey === key
      ? customization.templateInstalledAt || publishedAt
      : publishedAt,
    templatePublishedAt: publishedAt,
    fontFamily: isGroovy ? 'HEEBO' : customization.fontFamily,
    announcementBar: isGroovy && (!customization.announcementBar?.items?.length)
      ? {
          enabled: true,
          items: GROOVY_ANNOUNCEMENTS,
          separator: '|',
          backgroundColor: '#111111',
          textColor: '#ffffff',
          isAnimated: true,
          animationSpeed: 'NORMAL',
        }
      : customization.announcementBar,
    megaMenuEditorial: isGroovy
      ? {
          ...GROOVY_MEGA_MENU_EDITORIAL,
          ...(customization.megaMenuEditorial || {}),
        }
      : customization.megaMenuEditorial,
  }
}

export function resolveAdminTemplate(customization: SiteCustomization): StorefrontTemplateDefinition {
  const key = customization.templateKey === 'groovy' ? 'groovy' : 'classic'
  return STOREFRONT_TEMPLATES[key]
}

export function isTemplateCapabilityAvailable(
  template: StorefrontTemplateDefinition,
  capability: StorefrontTemplateCapability,
): boolean {
  return template.capabilities[capability] !== 'unsupported'
}
