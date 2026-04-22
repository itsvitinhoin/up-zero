// Standard e-commerce image dimensions
export const IMAGE_DIMENSIONS = {
  logo: { width: 200, height: 60, label: 'Logo (200x60px)' },
  favicon: { width: 32, height: 32, label: 'Favicon (32x32px)' },
  mainBanner: { width: 1920, height: 960, label: 'Banner Principal (1920x960px)' },
  categoryBanner: { width: 1200, height: 400, label: 'Banner de Categoria (1200x400px)' },
  productImage: { width: 800, height: 800, label: 'Imagem de Produto (800x800px)' },
  productThumbnail: { width: 400, height: 400, label: 'Miniatura (400x400px)' },
  pageContent: { width: 1200, height: 800, label: 'Imagem de Página (1200x800px)' },
} as const

export type ImageType = keyof typeof IMAGE_DIMENSIONS
