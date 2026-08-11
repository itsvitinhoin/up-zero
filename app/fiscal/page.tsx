import { redirect } from "next/navigation"

export const instant = false

export default function FiscalRedirect() {
  redirect("/settings/fiscal")
}
