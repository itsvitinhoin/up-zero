import { buildSectionMetadata, SettingsSectionPage } from "../_lib/section-page"

export const instant = false
export const metadata = buildSectionMetadata("b2b")

export default function Page() {
  return <SettingsSectionPage section="b2b" />
}
