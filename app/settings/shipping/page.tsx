import { buildSectionMetadata, SettingsSectionPage } from "../_lib/section-page"

export const instant = false
export const metadata = buildSectionMetadata("shipping")

export default function Page() {
  return <SettingsSectionPage section="shipping" />
}
