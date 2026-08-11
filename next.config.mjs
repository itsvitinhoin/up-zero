import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    // Permite rodar em paralelo com outros projetos Next.js no mesmo host
    turbopackFileSystemCacheForBuild: true,
    serverActions: {
      allowedOrigins: [
        'admin.upzero.com.br',
        'beta.upzero.com.br',
        'upzero.com.br',
        'upzero-next.mvxpc3.easypanel.host',
      ],
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
