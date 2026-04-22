import AdminSettingsPageClient from "@/components/admin/admin-settings-page-client"
import { cookies } from "next/headers"
import { getSiteSettingsAction, getStoreProfileAction, type StoreProfileConfig } from "@/lib/actions/settings"
import { getCategoriesAction } from "@/lib/actions/categories"
import type { Category, SiteSettings } from "@/lib/types"
import { notFound } from "next/navigation"

const VALID_SECTIONS = [
  "general",
  "b2b",
  "appearance",
  "payments",
  "shipping",
  "marketing",
  "domain",
  "billing",
  "stock",
] as const

type SettingsSection = (typeof VALID_SECTIONS)[number]

interface SettingsSectionPageProps {
  params: Promise<{ section: string }>
}

export async function generateMetadata({ params }: SettingsSectionPageProps) {
  const { section } = await params
  return {
    title: `Settings - ${section} | Admin`,
    description: "Configure your B2B store rules, appearance, and payments",
  }
}

export default async function AdminSettingsSectionPage({ params }: SettingsSectionPageProps) {
  const { section } = await params
  const cookieStore = await cookies()
  const locale = cookieStore.get("ADMIN_LOCALE")?.value || "pt-BR"

  if (!VALID_SECTIONS.includes(section as SettingsSection)) {
    notFound()
  }

  let initialSettings: SiteSettings | null = null
  let initialCategories: Category[] = []
  let initialStoreProfile: StoreProfileConfig | null = null

  try {
    const [settingsResult, categoriesResult, storeProfileResult] = await Promise.all([
      getSiteSettingsAction(),
      getCategoriesAction(),
      getStoreProfileAction(),
    ])

    if (settingsResult.success && settingsResult.data) {
      initialSettings = settingsResult.data
    }

    if (categoriesResult.success && categoriesResult.data) {
      initialCategories = categoriesResult.data
    }

    if (storeProfileResult.success && storeProfileResult.data) {
      initialStoreProfile = storeProfileResult.data
    }
  } catch (error) {
    console.error("Erro ao carregar dados de settings:", error)
  }

  return (
    <AdminSettingsPageClient
      locale={locale}
      currentPage={section as SettingsSection}
      initialSettings={initialSettings}
      initialCategories={initialCategories}
      initialStoreProfile={initialStoreProfile}
    />
  )
}
