'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { linkOfflineSellerAdminAction } from '@/lib/actions/offline'
import type { Admin } from '@/lib/actions/admins'

interface OfflineSellerAdminSelectProps {
  sellerId: number
  currentAdminId?: number | null
  admins: Admin[]
}

export function OfflineSellerAdminSelect({
  sellerId,
  currentAdminId,
  admins,
}: OfflineSellerAdminSelectProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedAdminId, setSelectedAdminId] = useState(
    currentAdminId != null ? String(currentAdminId) : 'none',
  )

  function handleChange(value: string) {
    const nextAdminId = value === 'none' ? null : Number.parseInt(value, 10)
    if (value !== 'none' && !Number.isFinite(nextAdminId)) return

    setSelectedAdminId(value)
    startTransition(async () => {
      const result = await linkOfflineSellerAdminAction(sellerId, nextAdminId)
      if (!result.success) {
        toast.error(result.error || 'Erro ao vincular vendedora')
        setSelectedAdminId(currentAdminId != null ? String(currentAdminId) : 'none')
        return
      }

      toast.success(nextAdminId ? 'Vendedora vinculada' : 'Vínculo removido')
      router.refresh()
    })
  }

  return (
    <div className="flex min-w-[180px] items-center gap-2">
      <Select value={selectedAdminId} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger className="h-9 w-full max-w-[220px]">
          <SelectValue placeholder="Não mapeada" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Não mapeada</SelectItem>
          {admins.map((admin) => (
            <SelectItem key={admin.id} value={String(admin.id)}>
              {admin.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" /> : null}
    </div>
  )
}
