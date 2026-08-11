"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { getAdminSession } from "@/lib/actions/auth"

const SESSION_CHECK_INTERVAL_MS = 3 * 60 * 1000

interface AdminSessionKeepaliveProps {
  enabled: boolean
}

export default function AdminSessionKeepalive({ enabled }: AdminSessionKeepaliveProps) {
  const pathname = usePathname()
  const lastCheckRef = useRef<number>(0)
  const lastHiddenAtRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled) return
    if (pathname?.startsWith("/login")) return

    const ping = async () => {
      const now = Date.now()
      if (now - lastCheckRef.current < SESSION_CHECK_INTERVAL_MS) {
        return
      }

      lastCheckRef.current = now

      try {
        await getAdminSession()
      } catch {
        // Ignore keepalive failures; normal auth checks still enforce login.
      }
    }

    const initialTimerId = window.setTimeout(() => {
      void ping()
    }, 800)

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        lastHiddenAtRef.current = Date.now()
        return
      }

      if (Date.now() - lastHiddenAtRef.current >= SESSION_CHECK_INTERVAL_MS) {
        lastCheckRef.current = 0
        void ping()
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      window.clearTimeout(initialTimerId)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [enabled, pathname])

  return null
}
