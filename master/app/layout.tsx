import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

// The installed Next.js distribution includes Geist, also used by the Admin.
const geist = localFont({ src: '../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2', variable: '--master-font-sans', display: 'swap' })
const mono = localFont({ src: '../../node_modules/next/dist/next-devtools/server/font/geist-mono-latin.woff2', variable: '--master-font-mono', display: 'swap' })

export const metadata: Metadata = { title: { default: 'Master | UP Zero', template: '%s | Master UP Zero' }, description: 'Gestão das lojas da plataforma UP Zero', robots: { index: false, follow: false } }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR" suppressHydrationWarning><body className={`${geist.variable} ${mono.variable} font-sans antialiased`}><ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="master-theme">{children}<Toaster /></ThemeProvider></body></html>
}
