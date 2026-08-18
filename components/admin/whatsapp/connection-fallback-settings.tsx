'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, PhoneForwarded, Save } from 'lucide-react'

import { AdminPanel } from '@/components/admin/admin-mobile-ui'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { WhatsAppState } from '@/lib/whatsapp/types'

type Props = {
  state: WhatsAppState
  reload: () => Promise<void>
}

async function saveFallback(phoneNumberId: string) {
  const response = await fetch('/api/mensageria/connections', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fallbackPhoneNumberId: phoneNumberId }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? 'Não foi possível salvar o número de fallback.')
}

export function ConnectionFallbackSettings({ state, reload }: Props) {
  const initialValue = state.integration.fallbackPhoneNumberId ?? state.integration.phoneNumberId ?? state.phoneNumbers[0]?.id ?? ''
  const [phoneNumberId, setPhoneNumberId] = useState(initialValue)
  const [savedPhoneNumberId, setSavedPhoneNumberId] = useState(initialValue)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setPhoneNumberId(initialValue)
    setSavedPhoneNumberId(initialValue)
  }, [initialValue])

  const selectedPhone = useMemo(
    () => state.phoneNumbers.find((phone) => phone.id === savedPhoneNumberId),
    [savedPhoneNumberId, state.phoneNumbers],
  )

  async function save() {
    if (!phoneNumberId) return
    setBusy(true)
    setError('')
    try {
      await saveFallback(phoneNumberId)
      await reload()
      setSavedPhoneNumberId(phoneNumberId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o número de fallback.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminPanel
      title="Número padrão de fallback"
      description="Defina aqui a conexão usada quando não houver um WhatsApp específico vinculado à vendedora."
      className="border-primary/20"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="fallback-phone-number">Conexão de envio</label>
          <Select value={phoneNumberId} onValueChange={setPhoneNumberId}>
            <SelectTrigger id="fallback-phone-number" className="w-full">
              <SelectValue placeholder="Selecione um número conectado" />
            </SelectTrigger>
            <SelectContent>
              {state.phoneNumbers.map((phone) => (
                <SelectItem key={phone.id} value={phone.id}>
                  {phone.verifiedName ?? 'WhatsApp'} · {phone.displayPhoneNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button className="gap-2" onClick={() => void save()} disabled={!phoneNumberId || busy || phoneNumberId === savedPhoneNumberId}>
          <Save className="h-4 w-4" />
          {busy ? 'Salvando...' : 'Salvar fallback'}
        </Button>
      </div>

      {selectedPhone ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-muted/45 p-3 text-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><PhoneForwarded className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{selectedPhone.verifiedName ?? 'WhatsApp conectado'}</p>
            <p className="text-muted-foreground">{selectedPhone.displayPhoneNumber}</p>
          </div>
          <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />Fallback ativo</Badge>
        </div>
      ) : null}

      {error ? <Alert variant="destructive" className="mt-4"><AlertTitle>Não foi possível salvar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
    </AdminPanel>
  )
}
