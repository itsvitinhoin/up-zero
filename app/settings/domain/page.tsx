import { buildSectionMetadata, SettingsSectionPage } from "../_lib/section-page"

export const instant = false
export const metadata = buildSectionMetadata("domain")

export default function Page() {
  return <SettingsSectionPage section="domain" />
}
