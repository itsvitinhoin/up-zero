import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
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
