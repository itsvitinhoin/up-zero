import { mutateState } from './repository'
import { providerReady, sendPush } from './provider'
import { finishCampaigns, materialize, quietNow, skipReason } from './engine'

export async function processStore(storeId: number, send = sendPush, ready = providerReady) {
  if (!ready(storeId)) return { processed: 0, reason: 'Serviço de Push não configurado.' }
  await mutateState(storeId, state => materialize(state))
  let processed = 0
  const started = Date.now()
  for (let index = 0; index < 25; index++) {
    if (Date.now() - started > 180000) break
    const claim = await mutateState(storeId, state => {
      if (!state.settings.enabled) return null
      const now = new Date()
      for (const job of state.jobs.filter(j => j.status === 'PENDING' && Date.parse(j.dueAt) <= now.getTime())) {
        const reason = skipReason(state, job)
        if (reason) { job.status = 'SKIPPED'; job.reason = reason; job.finishedAt = now.toISOString(); continue }
        if (job.kind !== 'B2B2C_ORDER') {
          if (quietNow(state, now)) continue
          const day = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: state.settings.timezone }).format(new Date(value))
          const todaysSends = new Set(state.jobs.filter(j => j.memberId === job.memberId && j.kind !== 'B2B2C_ORDER' && ['ACCEPTED', 'SENDING'].includes(j.status) && j.claimedAt && day(j.claimedAt) === day(now.toISOString())).map(j => j.campaignId ?? `${j.kind}:${j.reference}`))
          const thisSend = job.campaignId ?? `${job.kind}:${job.reference}`
          if (!todaysSends.has(thisSend) && todaysSends.size >= state.settings.dailyLimit) continue
        }
        job.status = 'SENDING'; job.claimedAt = now.toISOString()
        return { job: { ...job }, token: state.devices.find(d => d.id === job.deviceId)!.token }
      }
      finishCampaigns(state)
      return null
    })
    if (!claim) break
    let result: { accepted: boolean; invalid: boolean; reason: string | undefined }
    try { result = await send(storeId, claim.token, claim.job.message, claim.job.id) }
    catch { result = { accepted: false, invalid: false, reason: 'Resultado do envio não confirmado. Verifique antes de repetir.' } }
    await mutateState(storeId, state => {
      const job = state.jobs.find(j => j.id === claim.job.id)!
      job.status = result.accepted ? 'ACCEPTED' : 'FAILED'; job.reason = result.reason; job.finishedAt = new Date().toISOString()
      if (result.invalid) { const device = state.devices.find(d => d.id === job.deviceId); if (device?.token === claim.token) device.active = false }
      finishCampaigns(state)
    })
    processed++
  }
  return { processed }
}
